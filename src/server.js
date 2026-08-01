const express = require("express");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
app.use(express.json({ limit: "6mb" })); // images arrive as base64 JSON
app.use(express.static(path.join(__dirname, "..", "public")));

const POS_URL = process.env.POS_URL || "https://texasstores.up.railway.app";
const TZ = process.env.TZ_NAME || "America/Chicago";

// ---------------- POS items (read-only reference) ----------------
let itemsCache = { at: 0, data: null };
async function fetchPosItems() {
  if (itemsCache.data && Date.now() - itemsCache.at < 60_000) return itemsCache.data;
  const r = await fetch(`${POS_URL}/api/items`);
  if (!r.ok) throw new Error(`POS /api/items returned ${r.status}`);
  const data = await r.json();
  itemsCache = { at: Date.now(), data };
  return data;
}

// ---------------- PIN gate ----------------
// Public: kiosk endpoints, /api/auth, images. Everything else needs x-pin.
let pinCache = { at: 0, value: null };
async function getAdminPin() {
  if (pinCache.value !== null && Date.now() - pinCache.at < 10_000) return pinCache.value;
  const s = await prisma.setting.findUnique({ where: { key: "adminPin" } });
  pinCache = { at: Date.now(), value: s ? s.value : "2026" };
  return pinCache.value;
}
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/kiosk/") || req.path === "/api/auth" || req.path.startsWith("/api/images/"))
    return next();
  if (req.headers["x-pin"] === await getAdminPin()) return next();
  res.status(401).json({ error: "PIN required" });
});
app.post("/api/auth", async (req, res) => {
  res.json({ ok: (req.body && req.body.pin) === await getAdminPin() });
});

// ---------------- helpers ----------------
function promoPrice(item, promo) {
  if (!promo) return item.priceCents;
  if (promo.priceCents != null) return promo.priceCents;
  if (promo.pctOff != null) return Math.max(0, Math.round(item.priceCents * (1 - promo.pctOff / 100)));
  return item.priceCents;
}
async function menuData() {
  const [items, promos, infos] = await Promise.all([
    fetchPosItems(),
    prisma.promo.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.itemInfo.findMany()
  ]);
  const infoByName = Object.fromEntries(infos.map(i => [i.itemName, i]));
  const promoByName = {};
  for (const p of promos) promoByName[p.itemName] ||= p;
  return { items, promoByName, infoByName };
}

// ---------------- kiosk (public) ----------------
app.get("/api/kiosk/menu", async (_req, res) => {
  try {
    const { items, promoByName, infoByName } = await menuData();
    const menu = items
      .filter(i => (i.priceCents || 0) > 0 && !(infoByName[i.name] || {}).hidden)
      .map(i => {
        const p = promoByName[i.name];
        const info = infoByName[i.name];
        const imageId = (p && p.imageId) || (info && info.imageId) || null;
        return {
          name: i.name,
          category: i.category || "OTROS",
          priceCents: i.priceCents,
          description: (info && info.description) || null,
          imageUrl: imageId ? `/api/images/${imageId}` : (i.imageUrl || null),
          promo: p ? {
            title: p.title,
            description: p.description,
            promoPriceCents: promoPrice(i, p),
            featured: p.featured
          } : null
        };
      });
    const storeName = (await prisma.setting.findUnique({ where: { key: "storeName" } }))?.value || "Elotes Locos";
    res.json({ storeName, items: menu });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Place an order (prices computed server-side, promo-aware)
app.post("/api/kiosk/orders", async (req, res) => {
  try {
    const wanted = Array.isArray(req.body.items) ? req.body.items : [];
    if (!wanted.length) return res.status(400).json({ error: "Empty order" });
    const { items, promoByName, infoByName } = await menuData();
    const byName = Object.fromEntries(items.map(i => [i.name, i]));
    const lines = [];
    let total = 0;
    for (const w of wanted) {
      const it = byName[w.name];
      if (!it || (it.priceCents || 0) <= 0 || (infoByName[it.name] || {}).hidden) continue;
      const qty = Math.max(1, Math.min(50, Math.round(+w.qty || 1)));
      const unit = promoPrice(it, promoByName[it.name]);
      lines.push({ itemName: it.name, qty, priceCents: unit, lineTotalCents: unit * qty });
      total += unit * qty;
    }
    if (!lines.length) return res.status(400).json({ error: "No valid items" });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const startOfDay = new Date(`${today}T00:00:00-05:00`);
    const countToday = await prisma.kioskOrder.count({ where: { createdAt: { gte: startOfDay } } });
    const order = await prisma.kioskOrder.create({
      data: {
        number: countToday + 1,
        note: String(req.body.note || "").slice(0, 200) || null,
        totalCents: total,
        items: { create: lines }
      },
      include: { items: true }
    });
    res.json({ id: order.id, number: order.number, totalCents: order.totalCents });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/kiosk/orders/:id", async (req, res) => {
  const o = await prisma.kioskOrder.findUnique({ where: { id: +req.params.id } });
  if (!o) return res.status(404).json({ error: "Not found" });
  res.json({ id: o.id, number: o.number, status: o.status, totalCents: o.totalCents });
});

// Serve uploaded images (public, cached)
app.get("/api/images/:id", async (req, res) => {
  const img = await prisma.image.findUnique({ where: { id: +req.params.id } });
  if (!img) return res.status(404).end();
  res.set("Content-Type", img.mime);
  res.set("Cache-Control", "public, max-age=86400");
  res.send(Buffer.from(img.data));
});

// ---------------- dispatcher (PIN) ----------------
app.get("/api/orders", async (req, res) => {
  const open = req.query.open === "1";
  res.json(await prisma.kioskOrder.findMany({
    where: open ? { status: { in: ["pending", "charged"] } } : {},
    include: { items: true },
    orderBy: { id: "desc" },
    take: open ? 100 : 50
  }));
});

// Charge an order: records the sale in the POS (texasstores) exactly once,
// which deducts POS stock and feeds all downstream reports automatically.
// If kiosk promos made the total lower than POS prices, "Discount" units
// (negative price in the POS) are added so the recorded total matches.
app.post("/api/orders/:id/charge", async (req, res) => {
  try {
    const pm = req.body.paymentMethod === "credit" ? "credit" : "cash";
    const order = await prisma.kioskOrder.findUnique({
      where: { id: +req.params.id }, include: { items: true }
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending")
      return res.status(400).json({ error: `Order already ${order.status}` });

    const posItems = await fetchPosItems();
    const byName = Object.fromEntries(posItems.map(i => [i.name, i]));
    const items = [];
    let posTotal = 0;
    for (const li of order.items) {
      const it = byName[li.itemName];
      if (!it) return res.status(400).json({ error: `"${li.itemName}" no existe en el POS` });
      items.push({ itemId: it.id, quantity: li.qty });
      posTotal += it.priceCents * li.qty;
    }
    // offset promo discounts with the POS "Discount" item
    const disc = byName["Discount"];
    const diff = posTotal - order.totalCents;
    let discountCents = 0;
    if (diff > 0 && disc && disc.priceCents < 0) {
      const n = Math.round(diff / Math.abs(disc.priceCents));
      if (n > 0) { items.push({ itemId: disc.id, quantity: n }); discountCents = n * Math.abs(disc.priceCents); }
    }
    const expectedTotal = posTotal - discountCents;

    const body = { items, paymentMethod: pm };
    // the POS requires the tendered amount for cash sales (exact cash -> no change)
    if (pm === "cash") body.amountTenderedCents = expectedTotal;

    const r = await fetch(`${POS_URL}/api/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: j.error || `POS error ${r.status}` });

    const upd = await prisma.kioskOrder.update({
      where: { id: order.id },
      data: { status: "charged", paymentMethod: pm, posSaleId: j.saleId ?? null }
    });
    res.json({ ok: true, posSaleId: j.saleId ?? null, posTotalCents: j.totalCents ?? null, order: upd });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/orders/:id", async (req, res) => {
  try {
    const status = req.body.status;
    if (!["pending", "charged", "ready", "done", "cancelled"].includes(status))
      return res.status(400).json({ error: "Bad status" });
    res.json(await prisma.kioskOrder.update({ where: { id: +req.params.id }, data: { status } }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------------- manager (PIN) ----------------
// Items with kiosk extras (photo/hidden) for the manage page
app.get("/api/manage/items", async (_req, res) => {
  try {
    const { items, promoByName, infoByName } = await menuData();
    res.json(items.filter(i => i.priceCents > -100000).map(i => {
      const info = infoByName[i.name] || {};
      return {
        name: i.name, category: i.category, priceCents: i.priceCents,
        hidden: !!info.hidden,
        imageId: info.imageId || null,
        description: info.description || null,
        hasPromo: !!promoByName[i.name]
      };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/manage/items", async (req, res) => {
  try {
    const { itemName, hidden, imageId, description } = req.body;
    const data = {};
    if (hidden !== undefined) data.hidden = !!hidden;
    if (imageId !== undefined) data.imageId = imageId;
    if (description !== undefined) data.description = String(description || "").slice(0, 500) || null;
    res.json(await prisma.itemInfo.upsert({
      where: { itemName },
      create: { itemName, ...data },
      update: data
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Image upload: JSON { dataUrl: "data:image/jpeg;base64,..." } -> { id }
app.post("/api/images", async (req, res) => {
  try {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(req.body.dataUrl || "");
    if (!m) return res.status(400).json({ error: "Bad image" });
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: "Image too large" });
    const img = await prisma.image.create({ data: { mime: m[1], data: buf } });
    res.json({ id: img.id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Promos CRUD
app.get("/api/promos", async (_req, res) => {
  res.json(await prisma.promo.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }));
});
app.post("/api/promos", async (req, res) => {
  try {
    const b = req.body;
    res.json(await prisma.promo.create({ data: {
      title: b.title, description: b.description || null, itemName: b.itemName,
      pctOff: b.pctOff ?? null, priceCents: b.priceCents ?? null,
      imageId: b.imageId ?? null, featured: b.featured ?? true,
      active: b.active ?? true, sortOrder: b.sortOrder ?? 0
    }}));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put("/api/promos/:id", async (req, res) => {
  try {
    const { id, ...data } = req.body;
    res.json(await prisma.promo.update({ where: { id: +req.params.id }, data }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/promos/:id", async (req, res) => {
  try { res.json(await prisma.promo.delete({ where: { id: +req.params.id } })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Settings (PIN change, store name)
app.get("/api/settings", async (_req, res) => {
  const all = await prisma.setting.findMany();
  res.json(Object.fromEntries(all.map(s => [s.key, s.value])));
});
app.put("/api/settings", async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
    }
    pinCache = { at: 0, value: null };
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ordering system on :${port} (POS ref: ${POS_URL})`));
