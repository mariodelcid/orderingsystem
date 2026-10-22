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

const mgmt = require("./mgmt")(prisma, { TZ, fetchPosItems });

// ---------------- PIN gate ----------------
// Public: kiosk endpoints, /api/auth, images. Everything else needs x-pin.
let pinCache = { at: 0, value: null };
async function getAdminPin() {
  if (pinCache.value !== null && Date.now() - pinCache.at < 10_000) return pinCache.value;
  const s = await prisma.setting.findUnique({ where: { key: "adminPin" } });
  pinCache = { at: Date.now(), value: s ? s.value : "2026" };
  return pinCache.value;
}
// Owner-only area (Dueño page: costs, BOM, profit, inventory) uses its own PIN, separate from
// the admin/dispatcher PIN. The first time, the owner PIN is created with the admin PIN.
async function getOwnerPin() {
  const s = await prisma.setting.findUnique({ where: { key: "ownerPin" } });
  return s ? s.value : null;
}
app.post("/api/owner-auth", async (req, res) => {
  const owner = await getOwnerPin();
  res.json({ needsSetup: !owner, ok: !!owner && String((req.body && req.body.pin) || "") === owner });
});
app.post("/api/owner-setup", async (req, res) => {
  if (await getOwnerPin()) return res.status(400).json({ error: "El PIN de dueño ya existe" });
  if (String(req.body.adminPin || "") !== await getAdminPin()) return res.status(401).json({ error: "PIN de administrador incorrecto" });
  const pin = String(req.body.pin || "");
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "El PIN de dueño debe tener 4 a 8 números" });
  if (pin === await getAdminPin()) return res.status(400).json({ error: "Usa un PIN diferente al de administrador" });
  await prisma.setting.create({ data: { key: "ownerPin", value: pin } });
  res.json({ ok: true });
});
app.use("/api/mgmt", async (req, res, next) => {
  const owner = await getOwnerPin();
  if (!owner) return res.status(403).json({ error: "Crea primero el PIN de dueño", needsSetup: true });
  if (req.headers["x-owner-pin"] === owner) return next();
  res.status(401).json({ error: "PIN de dueño requerido" });
});
const OWNER_KEYS = ["ownerPin", "dailyOverheadCents", "cardFeePct"];

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/api/mgmt/") || req.path === "/api/owner-auth" || req.path === "/api/owner-setup") return next();
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
    const squareAppId = (await prisma.setting.findUnique({ where: { key: "squareAppId" } }))?.value || null;
    res.json({ storeName, squareAppId, items: menu });
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
    const payCard = req.body.paymentMethod === "card";
    const order = await prisma.kioskOrder.create({
      data: {
        number: countToday + 1,
        status: payCard ? "awaiting_card" : "pending",
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
  res.json({ id: o.id, number: o.number, status: o.status, totalCents: o.totalCents, paymentMethod: o.paymentMethod });
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

// ---------------- local sales ledger (lives only in this app) ----------------
// Sales are recorded ONLY here. Nothing is ever sent to texasstores (it is only read for the menu).

// Midnight in the store's time zone for a YYYY-MM-DD date (handles CST/CDT).
function tzMidnight(ymd) {
  const guess = new Date(`${ymd}T12:00:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = local - utc; // e.g. -5h in CDT
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - offsetMs);
}
function todayYmd() { return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); }
function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Build sale lines from {itemName, qty, priceCents} lines, snapshotting list price, category and cost.
async function buildSaleLines(lines) {
  let posItems = [];
  try { posItems = await fetchPosItems(); } catch (e) { console.error("items lookup failed", e.message); }
  const byName = Object.fromEntries(posItems.map(i => [i.name, i]));
  const infos = await prisma.itemInfo.findMany({ where: { itemName: { in: lines.map(l => l.itemName) } } });
  // Cost priority: BOM recipe (Costos y Ganancias mapping) -> manual cost on the Ventas page -> 0
  const bomCost = await mgmt.unitCostCentsByName(lines.map(l => l.itemName));
  const costBy = Object.fromEntries(infos.map(i => [i.itemName, i.costCents || 0]));
  Object.assign(costBy, bomCost);
  let subtotal = 0, total = 0, cost = 0;
  const items = lines.map(l => {
    const it = byName[l.itemName];
    const list = it && it.priceCents > 0 ? it.priceCents : l.priceCents;
    const unitCost = costBy[l.itemName] || 0;
    subtotal += list * l.qty; total += l.priceCents * l.qty; cost += unitCost * l.qty;
    return {
      itemName: l.itemName, category: (it && it.category) || null, qty: l.qty,
      listPriceCents: list, priceCents: l.priceCents, lineTotalCents: l.priceCents * l.qty, unitCostCents: unitCost
    };
  });
  return { items, subtotal, total, cost };
}

// Record a charged kiosk order in the local ledger. Idempotent per order.
async function recordLocalSale(order, pm, extra = {}) {
  const existing = await prisma.sale.findUnique({ where: { orderId: order.id } });
  if (existing) return existing;
  const { items, subtotal, total, cost } = await buildSaleLines(order.items);
  const tendered = pm === "cash" && extra.tenderedCents >= total ? Math.round(extra.tenderedCents) : null;
  return prisma.sale.create({
    data: {
      createdAt: extra.createdAt || undefined,
      orderId: order.id, orderNumber: order.number,
      source: extra.source || "dispatch", paymentMethod: pm,
      subtotalCents: subtotal, discountCents: Math.max(0, subtotal - total), totalCents: total, costCents: cost,
      tenderedCents: tendered, changeCents: tendered != null ? tendered - total : null,
      squareTxId: extra.squareTxId || null,
      items: { create: items }
    }
  });
}

// Dispatcher charges a cash (pending) order
app.post("/api/orders/:id/charge", async (req, res) => {
  try {
    const pm = req.body.paymentMethod === "credit" ? "credit" : "cash";
    const order = await prisma.kioskOrder.findUnique({
      where: { id: +req.params.id }, include: { items: true }
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending")
      return res.status(400).json({ error: `Order already ${order.status}` });
    const sale = await recordLocalSale(order, pm, { source: "dispatch", tenderedCents: +req.body.tenderedCents || null });
    const upd = await prisma.kioskOrder.update({
      where: { id: order.id },
      data: { status: "charged", paymentMethod: pm }
    });
    res.json({ ok: true, saleId: sale.id, totalCents: sale.totalCents, order: upd });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------- kiosk card payments (Square Point of Sale app) ----------------
// Square app returned a successful card payment for an awaiting_card order.
app.post("/api/kiosk/orders/:id/card-paid", async (req, res) => {
  try {
    const txId = String(req.body.transactionId || "").slice(0, 100);
    if (!txId) return res.status(400).json({ error: "Missing transaction id" });
    const order = await prisma.kioskOrder.findUnique({
      where: { id: +req.params.id }, include: { items: true }
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "charged" && order.squareTxId === txId)
      return res.json({ ok: true, number: order.number, totalCents: order.totalCents }); // callback reloaded
    if (order.status !== "awaiting_card")
      return res.status(400).json({ error: `Order already ${order.status}` });
    // The customer already paid in Square: the order must reach dispatch even if the POS is down.
    // The customer already paid in Square: the order must reach dispatch even if saving the sale fails.
    let posError = null;
    try { await recordLocalSale(order, "credit", { source: "kiosk_card", squareTxId: txId }); }
    catch (e) { posError = ("No se guardó la venta: " + e.message).slice(0, 200); console.error("ledger failed for order", order.id, e.message); }
    const upd = await prisma.kioskOrder.update({
      where: { id: order.id },
      data: { status: "charged", paymentMethod: "credit", squareTxId: txId, posError }
    });
    res.json({ ok: true, number: upd.number, totalCents: upd.totalCents });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer gave up on the card and will pay cash at the counter.
app.post("/api/kiosk/orders/:id/to-cash", async (req, res) => {
  try {
    const order = await prisma.kioskOrder.findUnique({ where: { id: +req.params.id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "awaiting_card") return res.status(400).json({ error: `Order already ${order.status}` });
    const upd = await prisma.kioskOrder.update({ where: { id: order.id }, data: { status: "pending" } });
    res.json({ ok: true, number: upd.number, totalCents: upd.totalCents });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer cancelled an unpaid card order at the kiosk.
app.post("/api/kiosk/orders/:id/cancel", async (req, res) => {
  try {
    const order = await prisma.kioskOrder.findUnique({ where: { id: +req.params.id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "awaiting_card") return res.status(400).json({ error: `Order already ${order.status}` });
    await prisma.kioskOrder.update({ where: { id: order.id }, data: { status: "cancelled" } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Square sends the customer back here after the payment; the kiosk page reads the result.
app.get("/square-callback", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

app.put("/api/orders/:id", async (req, res) => {
  try {
    const status = req.body.status;
    if (!["pending", "charged", "ready", "done", "cancelled"].includes(status))
      return res.status(400).json({ error: "Bad status" });
    const upd = await prisma.kioskOrder.update({ where: { id: +req.params.id }, data: { status } });
    if (status === "cancelled")
      await prisma.sale.updateMany({
        where: { orderId: upd.id, voided: false },
        data: { voided: true, voidedAt: new Date(), voidReason: "Orden cancelada en despacho" }
      });
    res.json(upd);
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
  const all = (await prisma.setting.findMany()).filter(s => !OWNER_KEYS.includes(s.key));
  res.json(Object.fromEntries(all.map(s => [s.key, s.value])));
});
app.put("/api/settings", async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (OWNER_KEYS.includes(key)) continue; // owner settings live on the Dueño page
      await prisma.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
    }
    pinCache = { at: 0, value: null };
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------------- Costos y Ganancias (clone of texas-stores-management, PIN) ----------------
app.use("/api/mgmt", mgmt.router);

// ---------------- Ventas (local ledger, PIN) ----------------
function parseRange(q) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = re.test(q.from || "") ? q.from : todayYmd();
  const to = re.test(q.to || "") ? q.to : from;
  return { from, to, gte: tzMidnight(from), lt: tzMidnight(addDays(to, 1)) };
}
const localDay = d => d.toLocaleDateString("en-CA", { timeZone: TZ });
const localHour = d => +d.toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }) % 24;

app.get("/api/sales/report", async (req, res) => {
  try {
    const r = parseRange(req.query);
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: r.gte, lt: r.lt } },
      include: { items: true }, orderBy: { id: "desc" }
    });
    const t = { count: 0, gross: 0, discounts: 0, net: 0, cash: 0, card: 0, cashCount: 0, cardCount: 0,
                cost: 0, profit: 0, items: 0, voidedCount: 0, voidedCents: 0, missingCost: 0 };
    const byItem = {}, byHour = {}, byDay = {}, bySource = {};
    for (const s of sales) {
      if (s.voided) { t.voidedCount++; t.voidedCents += s.totalCents; continue; }
      t.count++; t.gross += s.subtotalCents; t.discounts += s.discountCents; t.net += s.totalCents; t.cost += s.costCents;
      if (s.paymentMethod === "cash") { t.cash += s.totalCents; t.cashCount++; } else { t.card += s.totalCents; t.cardCount++; }
      const h = localHour(s.createdAt); byHour[h] = (byHour[h] || 0) + s.totalCents;
      const d = localDay(s.createdAt); byDay[d] ||= { day: d, count: 0, net: 0, profit: 0 };
      byDay[d].count++; byDay[d].net += s.totalCents; byDay[d].profit += s.totalCents - s.costCents;
      bySource[s.source] = (bySource[s.source] || 0) + s.totalCents;
      for (const i of s.items) {
        t.items += i.qty;
        const k = byItem[i.itemName] ||= { name: i.itemName, category: i.category, qty: 0, net: 0, cost: 0, noCost: false };
        k.qty += i.qty; k.net += i.lineTotalCents; k.cost += i.unitCostCents * i.qty;
        if (!i.unitCostCents) k.noCost = true;
      }
    }
    // Costs and profit are owner-only (Dueño page); never sent to the Ventas page.
    delete t.cost; delete t.profit; delete t.missingCost;
    res.json({
      from: r.from, to: r.to, totals: t,
      byItem: Object.values(byItem).sort((a, b) => b.net - a.net).map(({ name, category, qty, net }) => ({ name, category, qty, net })),
      byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, net: byHour[h] || 0 })),
      byDay: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map(({ day, count, net }) => ({ day, count, net })),
      bySource,
      sales: sales.slice(0, 400).map(({ costCents, items, ...rest }) => ({
        ...rest, items: items.map(({ unitCostCents, ...i }) => i)
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual sale from the Caja tab (prices computed server-side, promo-aware). Never touches texasstores.
app.post("/api/sales", async (req, res) => {
  try {
    const wanted = Array.isArray(req.body.items) ? req.body.items : [];
    const pm = req.body.paymentMethod === "credit" ? "credit" : "cash";
    const { items, promoByName } = await menuData();
    const byName = Object.fromEntries(items.map(i => [i.name, i]));
    const lines = [];
    for (const w of wanted) {
      const it = byName[w.name];
      if (!it || (it.priceCents || 0) <= 0) continue;
      const qty = Math.max(1, Math.min(99, Math.round(+w.qty || 1)));
      lines.push({ itemName: it.name, qty, priceCents: promoPrice(it, promoByName[it.name]) });
    }
    if (!lines.length) return res.status(400).json({ error: "Agrega al menos un producto" });
    const built = await buildSaleLines(lines);
    let tendered = null;
    if (pm === "cash") {
      tendered = req.body.tenderedCents == null || req.body.tenderedCents === "" ? built.total : Math.round(+req.body.tenderedCents);
      if (!(tendered >= built.total)) return res.status(400).json({ error: "El efectivo recibido es menor que el total" });
    }
    const sale = await prisma.sale.create({
      data: {
        source: "caja", paymentMethod: pm,
        subtotalCents: built.subtotal, discountCents: Math.max(0, built.subtotal - built.total),
        totalCents: built.total, costCents: built.cost,
        tenderedCents: tendered, changeCents: tendered != null ? tendered - built.total : null,
        items: { create: built.items }
      },
      include: { items: true }
    });
    const { costCents, ...pub } = sale;
    res.json({ ...pub, items: sale.items.map(({ unitCostCents, ...i }) => i) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sales/:id/void", async (req, res) => {
  try {
    const s = await prisma.sale.findUnique({ where: { id: +req.params.id } });
    if (!s) return res.status(404).json({ error: "Venta no encontrada" });
    if (s.voided) return res.status(400).json({ error: "Ya estaba anulada" });
    res.json(await prisma.sale.update({
      where: { id: s.id },
      data: { voided: true, voidedAt: new Date(), voidReason: String(req.body.reason || "").slice(0, 200) || null }
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get("/api/sales/csv", async (req, res) => {
  try {
    const r = parseRange(req.query);
    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: r.gte, lt: r.lt } }, include: { items: true }, orderBy: { id: "asc" }
    });
    const esc = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const $ = c => (c / 100).toFixed(2);
    const rows = [["venta", "fecha", "hora", "orden", "origen", "pago", "producto", "cant", "precio", "total_linea", "anulada"]];
    for (const s of sales) for (const i of s.items) rows.push([
      s.id, localDay(s.createdAt), s.createdAt.toLocaleTimeString("es-MX", { timeZone: TZ }),
      s.orderNumber ?? "", s.source, s.paymentMethod === "cash" ? "efectivo" : "tarjeta",
      i.itemName, i.qty, $(i.priceCents), $(i.lineTotalCents), s.voided ? "si" : ""
    ]);
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="ventas_${r.from}_${r.to}.csv"`);
    res.send("\ufeff" + rows.map(r => r.map(esc).join(",")).join("\n"));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// One-time fill: kiosk orders charged before the ledger existed get a sale row (dated when ordered).
async function backfillLedger() {
  try {
    const orders = await prisma.kioskOrder.findMany({
      where: { status: { in: ["charged", "ready", "done"] }, paymentMethod: { in: ["cash", "credit"] } },
      include: { items: true }
    });
    const have = new Set((await prisma.sale.findMany({ where: { orderId: { not: null } }, select: { orderId: true } })).map(s => s.orderId));
    let n = 0;
    for (const o of orders) {
      if (have.has(o.id)) continue;
      await recordLocalSale(o, o.paymentMethod, { source: o.squareTxId ? "kiosk_card" : "dispatch", squareTxId: o.squareTxId, createdAt: o.createdAt });
      n++;
    }
    if (n) console.log(`Ledger backfill: ${n} past orders added`);
  } catch (e) { console.error("Ledger backfill failed", e.message); }
}

// Short links: /dispatch and /manage work without ".html"
app.get("/dispatch", (_req, res) => res.redirect("/dispatch.html"));
app.get("/manage", (_req, res) => res.redirect("/manage.html"));
app.get("/ventas", (_req, res) => res.redirect("/sales.html"));
app.get("/dueno", (_req, res) => res.redirect("/dueno.html"));

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Ordering system on :${port} (POS ref: ${POS_URL})`); mgmt.ensureData().then(backfillLedger); });
