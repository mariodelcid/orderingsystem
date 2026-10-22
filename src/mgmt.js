// Costos y Ganancias — clone of texas-stores-management, running inside orderingsystem.
// Same ingredients / BOM / mixes / mapping / overhead logic, but SALES come from this
// app's own ledger (Sale table). Nothing here reads or writes texasstores sales.
const express = require("express");

const IMPORT_URL = process.env.MGMT_IMPORT_URL || "https://texas-stores-management-test-production.up.railway.app";

module.exports = function mgmt(prisma, { TZ, fetchPosItems }) {
  const r = express.Router();
  const localDate = d => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  // Ledger sales in the same shape the management site used from the POS.
  async function getAllSales() {
    const sales = await prisma.sale.findMany({ where: { voided: false }, include: { items: true } });
    return sales.map(s => ({
      id: s.id, createdAt: s.createdAt, paymentMethod: s.paymentMethod, totalCents: s.totalCents,
      items: s.items.map(i => ({ quantity: i.qty, lineTotalCents: i.lineTotalCents, item: { name: i.itemName } }))
    }));
  }
  async function cardCentsByDate() {
    const map = {};
    for (const s of await getAllSales())
      if (s.paymentMethod === "credit") { const d = localDate(s.createdAt); map[d] = (map[d] || 0) + (s.totalCents || 0); }
    return map;
  }
  async function bomCostByProductId() {
    const lines = await prisma.bomLine.findMany({ include: { ingredient: true } });
    const cost = {};
    for (const l of lines) cost[l.productId] = (cost[l.productId] || 0) + l.quantity * (l.ingredient.costPerUnit || 0);
    return cost; // dollars per unit sold
  }
  const getSetting = async (key, def) => {
    const s = await prisma.setting.findUnique({ where: { key } });
    return s ? s.value : def;
  };
  const getCardFeePct = async () => parseFloat(await getSetting("cardFeePct", "0")) || 0;
  const getDailyOverheadCents = async () => parseInt(await getSetting("dailyOverheadCents", "0"), 10) || 0;
  async function context() {
    const [sales, maps, costs, overheadCents, cardByDate, cardFeePct] = await Promise.all([
      getAllSales(), prisma.posMap.findMany({ include: { product: true } }), bomCostByProductId(),
      getDailyOverheadCents(), cardCentsByDate(), getCardFeePct()
    ]);
    return { sales, mapByName: Object.fromEntries(maps.map(m => [m.posName, m])), costs, overheadCents, cardByDate, cardFeePct };
  }

  // ---------- profit endpoints ----------
  r.get("/daily", async (req, res) => {
    try {
      const date = req.query.date || today();
      const { sales, mapByName, costs, overheadCents, cardByDate, cardFeePct } = await context();
      const rows = {};
      let saleCount = 0;
      for (const sale of sales) {
        if (localDate(sale.createdAt) !== date) continue;
        saleCount++;
        for (const li of sale.items) {
          const name = li.item.name;
          const row = (rows[name] ||= { posName: name, qty: 0, revenueCents: 0, costCents: 0, profitCents: 0, mapped: true, productCode: null });
          const m = mapByName[name];
          const revenue = li.lineTotalCents || 0;
          row.qty += li.quantity || 0;
          row.revenueCents += revenue;
          if (m && m.kind === "ignore") { row.ignored = true; continue; }
          if (m && m.kind === "zerocost") { row.profitCents += revenue; row.productCode = "(no cost)"; }
          else if (m && m.product) {
            const c = Math.round((costs[m.productId] || 0) * 100) * (li.quantity || 0);
            row.costCents += c; row.profitCents += revenue - c; row.productCode = m.product.code;
          } else row.mapped = false;
        }
      }
      const list = Object.values(rows).sort((a, b) => b.revenueCents - a.revenueCents);
      const totals = list.reduce((t, x) => {
        t.qty += x.qty; t.revenueCents += x.revenueCents; t.costCents += x.costCents;
        if (x.mapped) t.profitCents += x.profitCents; else t.unmappedRevenueCents += x.revenueCents;
        return t;
      }, { qty: 0, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0 });
      const cardCents = cardByDate[date] || 0;
      const cardFeeCents = Math.round(cardCents * cardFeePct / 100);
      res.json({
        date, timezone: TZ, saleCount, baseOverheadCents: overheadCents, cardCents, cardFeePct, cardFeeCents,
        overheadCents: overheadCents + cardFeeCents, items: list,
        totals: { ...totals, netProfitCents: totals.profitCents - overheadCents - cardFeeCents }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  r.get("/range", async (req, res) => {
    try {
      const { sales, mapByName, costs, overheadCents, cardByDate, cardFeePct } = await context();
      const days = {};
      for (const sale of sales) {
        const d = localDate(sale.createdAt);
        if (req.query.start && d < req.query.start) continue;
        if (req.query.end && d > req.query.end) continue;
        const day = (days[d] ||= { date: d, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0 });
        for (const li of sale.items) {
          const m = mapByName[li.item.name];
          const revenue = li.lineTotalCents || 0;
          day.revenueCents += revenue;
          if (m && m.kind === "ignore") continue;
          if (m && m.kind === "zerocost") day.profitCents += revenue;
          else if (m && m.product) {
            const c = Math.round((costs[m.productId] || 0) * 100) * (li.quantity || 0);
            day.costCents += c; day.profitCents += revenue - c;
          } else day.unmappedRevenueCents += revenue;
        }
      }
      const list = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
      for (const d of list) {
        d.cardCents = cardByDate[d.date] || 0;
        d.cardFeeCents = Math.round(d.cardCents * cardFeePct / 100);
        d.overheadCents = overheadCents + d.cardFeeCents;
        d.netProfitCents = d.profitCents - d.overheadCents;
      }
      res.json({ overheadCents, cardFeePct, days: list });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---------- ingredients ----------
  const ingFields = b => {
    const keys = ["code", "name", "unit", "purchaseUnits", "pricePerPU", "costPerUnit", "provider1", "provider1Price",
      "provider2", "provider2Price", "provider3", "provider3Price", "stockOnHand", "countedAt"];
    return Object.fromEntries(keys.filter(k => k in b).map(k => [k, b[k]]));
  };
  r.get("/ingredients", async (_req, res) => res.json(await prisma.ingredient.findMany({ orderBy: { code: "asc" } })));
  r.post("/ingredients", async (req, res) => {
    try { res.json(await prisma.ingredient.create({ data: ingFields(req.body) })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.put("/ingredients/:id", async (req, res) => {
    try { res.json(await prisma.ingredient.update({ where: { id: +req.params.id }, data: ingFields(req.body) })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete("/ingredients/:id", async (req, res) => {
    try { res.json(await prisma.ingredient.delete({ where: { id: +req.params.id } })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ---------- products ----------
  r.get("/products", async (_req, res) => {
    const [products, costs] = await Promise.all([
      prisma.product.findMany({ orderBy: { code: "asc" }, include: { bomLines: { include: { ingredient: true }, orderBy: { id: "asc" } } } }),
      bomCostByProductId()
    ]);
    res.json(products.map(p => ({ ...p, bomCost: +(costs[p.id] || 0).toFixed(4) })));
  });
  r.post("/products", async (req, res) => {
    try { const { code, name, priceCents } = req.body; res.json(await prisma.product.create({ data: { code, name, priceCents } })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.put("/products/:id", async (req, res) => {
    try {
      const data = {};
      for (const k of ["code", "name", "priceCents"]) if (k in req.body) data[k] = req.body[k];
      res.json(await prisma.product.update({ where: { id: +req.params.id }, data }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete("/products/:id", async (req, res) => {
    try { res.json(await prisma.product.delete({ where: { id: +req.params.id } })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.put("/products/:id/bom", async (req, res) => {
    try {
      const productId = +req.params.id;
      const ing = Object.fromEntries((await prisma.ingredient.findMany()).map(i => [i.code, i.id]));
      const lines = [];
      for (const l of req.body) {
        if (!ing[l.ingredientCode]) return res.status(400).json({ error: `Unknown ingredient code ${l.ingredientCode}` });
        lines.push({ productId, ingredientId: ing[l.ingredientCode], componentType: l.componentType || null, quantity: +l.quantity || 0 });
      }
      await prisma.$transaction([prisma.bomLine.deleteMany({ where: { productId } }), prisma.bomLine.createMany({ data: lines })]);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ---------- mixes ----------
  r.get("/mixes", async (_req, res) => res.json(await prisma.mix.findMany({ include: { lines: true }, orderBy: { id: "asc" } })));
  r.post("/mixes", async (req, res) => {
    try {
      const { name, linkedIngredientCode, lines = [] } = req.body;
      res.json(await prisma.mix.create({ data: { name, linkedIngredientCode, lines: { create: lines } }, include: { lines: true } }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.put("/mixes/:id", async (req, res) => {
    try {
      const { name, linkedIngredientCode, lines = [] } = req.body;
      const id = +req.params.id;
      await prisma.$transaction([
        prisma.mixLine.deleteMany({ where: { mixId: id } }),
        prisma.mix.update({ where: { id }, data: { name, linkedIngredientCode,
          lines: { create: lines.map(l => ({ componentName: l.componentName, oz: l.oz, cost: l.cost })) } } })
      ]);
      res.json(await prisma.mix.findUnique({ where: { id }, include: { lines: true } }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete("/mixes/:id", async (req, res) => {
    try { res.json(await prisma.mix.delete({ where: { id: +req.params.id } })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ---------- item mapping ----------
  r.get("/mappings", async (_req, res) => res.json(await prisma.posMap.findMany({ include: { product: true }, orderBy: { posName: "asc" } })));
  r.post("/mappings", async (req, res) => {
    try {
      const { posName, kind, productCode } = req.body;
      let productId = null;
      if (productCode) {
        const p = await prisma.product.findUnique({ where: { code: productCode } });
        if (!p) return res.status(400).json({ error: `Unknown product code ${productCode}` });
        productId = p.id;
      }
      res.json(await prisma.posMap.upsert({
        where: { posName }, create: { posName, kind: kind || "product", productId }, update: { kind: kind || "product", productId }
      }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.delete("/mappings/:id", async (req, res) => {
    try { res.json(await prisma.posMap.delete({ where: { id: +req.params.id } })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Item names to map: the menu (read-only from texasstores) + anything already sold here
  r.get("/item-names", async (_req, res) => {
    let menu = [];
    try { menu = (await fetchPosItems()).map(i => i.name); } catch (_) {}
    const sold = (await prisma.saleItem.findMany({ select: { itemName: true }, distinct: ["itemName"] })).map(s => s.itemName);
    res.json([...new Set([...menu, ...sold])]);
  });

  // ---------- settings (overhead + card fee) ----------
  r.get("/settings", async (_req, res) => {
    res.json({ dailyOverheadCents: await getSetting("dailyOverheadCents", "0"), cardFeePct: await getSetting("cardFeePct", "0"), importSource: IMPORT_URL });
  });
  r.put("/settings", async (req, res) => {
    try {
      for (const key of ["dailyOverheadCents", "cardFeePct"]) if (key in req.body) {
        const value = String(req.body[key]);
        await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ---------- inventory (ingredient usage from sales x BOM) ----------
  r.get("/inventory", async (req, res) => {
    try {
      const start = req.query.start || today(), end = req.query.end || today();
      const [sales, maps, ingredients, bomLines] = await Promise.all([
        getAllSales(), prisma.posMap.findMany(), prisma.ingredient.findMany({ orderBy: { code: "asc" } }), prisma.bomLine.findMany()
      ]);
      const mapByName = Object.fromEntries(maps.map(m => [m.posName, m]));
      const bomByProduct = {};
      for (const l of bomLines) (bomByProduct[l.productId] ||= []).push(l);
      const rangeUsage = {}, sinceUsage = {};
      const counted = Object.fromEntries(ingredients.filter(i => i.countedAt).map(i => [i.id, new Date(i.countedAt).getTime()]));
      for (const sale of sales) {
        const d = localDate(sale.createdAt), t = new Date(sale.createdAt).getTime(), inRange = d >= start && d <= end;
        for (const li of sale.items) {
          const m = mapByName[li.item.name];
          if (!m || m.kind !== "product" || !m.productId) continue;
          for (const bl of bomByProduct[m.productId] || []) {
            const used = bl.quantity * (li.quantity || 0);
            if (inRange) rangeUsage[bl.ingredientId] = (rangeUsage[bl.ingredientId] || 0) + used;
            if (counted[bl.ingredientId] && t > counted[bl.ingredientId]) sinceUsage[bl.ingredientId] = (sinceUsage[bl.ingredientId] || 0) + used;
          }
        }
      }
      res.json({
        start, end, timezone: TZ,
        ingredients: ingredients.map(i => {
          const usageSinceCount = i.countedAt ? +(sinceUsage[i.id] || 0).toFixed(2) : null;
          return {
            id: i.id, code: i.code, name: i.name, unit: i.unit, used: +(rangeUsage[i.id] || 0).toFixed(2),
            stockOnHand: i.stockOnHand, countedAt: i.countedAt, usageSinceCount,
            estRemaining: i.stockOnHand != null && usageSinceCount != null ? +(i.stockOnHand - usageSinceCount).toFixed(2) : null
          };
        })
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Usage of one ingredient (from sales x BOM) since a moment in time
  async function usageSince(ingredientId, since) {
    const bl = await prisma.bomLine.findMany({ where: { ingredientId } });
    if (!bl.length) return 0;
    const qtyPerProduct = {};
    for (const l of bl) qtyPerProduct[l.productId] = (qtyPerProduct[l.productId] || 0) + l.quantity;
    const maps = (await prisma.posMap.findMany({ where: { kind: "product" } })).filter(m => qtyPerProduct[m.productId] != null);
    const perName = Object.fromEntries(maps.map(m => [m.posName, qtyPerProduct[m.productId]]));
    const t = new Date(since).getTime();
    let used = 0;
    for (const s of await getAllSales()) {
      if (new Date(s.createdAt).getTime() <= t) continue;
      for (const li of s.items) if (perName[li.item.name] != null) used += perName[li.item.name] * (li.quantity || 0);
    }
    return used;
  }
  async function estStock(g) {
    if (g.stockOnHand == null || !g.countedAt) return null;
    return g.stockOnHand - await usageSince(g.id, g.countedAt);
  }

  // Replenish: add a delivery to the estimated stock (optionally update the purchase price -> cost per unit)
  r.post("/ingredients/:id/receive", async (req, res) => {
    try {
      const g = await prisma.ingredient.findUnique({ where: { id: +req.params.id } });
      if (!g) return res.status(404).json({ error: "Ingredient not found" });
      const qty = +req.body.qty;
      if (!(qty > 0)) return res.status(400).json({ error: "Quantity must be more than 0" });
      const before = await estStock(g);
      const stockAfter = +(((before ?? 0)) + qty).toFixed(4);
      const data = { stockOnHand: stockAfter, countedAt: new Date() };
      const price = req.body.pricePerPU;
      if (price !== undefined && price !== null && price !== "" && +price >= 0) {
        data.pricePerPU = +price;
        if (g.purchaseUnits > 0) data.costPerUnit = +(+price / g.purchaseUnits).toFixed(4);
      }
      const upd = await prisma.ingredient.update({ where: { id: g.id }, data });
      await prisma.inventoryMove.create({ data: {
        ingredientId: g.id, kind: "receive", qty, stockAfter, costPerUnit: upd.costPerUnit, note: req.body.note ? String(req.body.note).slice(0, 200) : null
      } });
      res.json({ ok: true, before, stockAfter, costPerUnit: upd.costPerUnit });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Physical count: sets the stock to what is actually on the shelf
  r.post("/ingredients/:id/count", async (req, res) => {
    try {
      const qty = +req.body.qty;
      if (!(qty >= 0)) return res.status(400).json({ error: "Invalid count" });
      const g = await prisma.ingredient.update({ where: { id: +req.params.id }, data: { stockOnHand: qty, countedAt: new Date() } });
      await prisma.inventoryMove.create({ data: { ingredientId: g.id, kind: "count", qty, stockAfter: qty } });
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  r.get("/moves", async (_req, res) => {
    const moves = await prisma.inventoryMove.findMany({ orderBy: { id: "desc" }, take: 50 });
    const ings = Object.fromEntries((await prisma.ingredient.findMany()).map(i => [i.id, i]));
    res.json(moves.map(m => ({ ...m, code: ings[m.ingredientId]?.code, name: ings[m.ingredientId]?.name, unit: ings[m.ingredientId]?.unit })));
  });

  // Change the owner PIN
  r.put("/owner-pin", async (req, res) => {
    const pin = String(req.body.pin || "");
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4 to 8 digits" });
    const admin = await prisma.setting.findUnique({ where: { key: "adminPin" } });
    if (pin === (admin ? admin.value : "2026")) return res.status(400).json({ error: "Use a different PIN than the admin PIN" });
    await prisma.setting.upsert({ where: { key: "ownerPin" }, create: { key: "ownerPin", value: pin }, update: { value: pin } });
    res.json({ ok: true });
  });

  // ---------- weekly / monthly report ----------
  r.get("/report", async (req, res) => {
    try {
      const period = req.query.period === "month" ? "month" : "week";
      const t0 = today(), ref = req.query.date || t0;
      const [y, m, d] = ref.split("-").map(Number);
      let start, end;
      if (period === "month") {
        start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
        end = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
      } else {
        const dt = new Date(Date.UTC(y, m - 1, d)), dow = (dt.getUTCDay() + 6) % 7;
        const mon = new Date(dt); mon.setUTCDate(dt.getUTCDate() - dow);
        const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
        start = mon.toISOString().slice(0, 10); end = sun.toISOString().slice(0, 10);
      }
      const { sales, mapByName, costs, overheadCents, cardByDate, cardFeePct } = await context();
      const days = {}, items = {};
      let saleCount = 0;
      for (const sale of sales) {
        const dd = localDate(sale.createdAt);
        if (dd < start || dd > end) continue;
        saleCount++;
        const day = (days[dd] ||= { date: dd, revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0, sales: 0 });
        day.sales++;
        for (const li of sale.items) {
          const name = li.item.name;
          const it = (items[name] ||= { posName: name, qty: 0, revenueCents: 0, costCents: 0, profitCents: 0, mapped: true });
          const revenue = li.lineTotalCents || 0, m2 = mapByName[name];
          day.revenueCents += revenue; it.qty += li.quantity || 0; it.revenueCents += revenue;
          if (m2 && m2.kind === "ignore") continue;
          if (m2 && m2.kind === "zerocost") { day.profitCents += revenue; it.profitCents += revenue; }
          else if (m2 && m2.product) {
            const c = Math.round((costs[m2.productId] || 0) * 100) * (li.quantity || 0);
            day.costCents += c; day.profitCents += revenue - c; it.costCents += c; it.profitCents += revenue - c;
          } else { day.unmappedRevenueCents += revenue; it.mapped = false; }
        }
      }
      const lastDay = end < t0 ? end : t0;
      let daysElapsed = 0;
      if (start <= lastDay) daysElapsed = Math.round((new Date(lastDay + "T00:00:00Z") - new Date(start + "T00:00:00Z")) / 86400000) + 1;
      const dayList = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
      const itemList = Object.values(items).sort((a, b) => b.revenueCents - a.revenueCents);
      const totals = dayList.reduce((t, x) => {
        t.revenueCents += x.revenueCents; t.costCents += x.costCents; t.profitCents += x.profitCents;
        t.unmappedRevenueCents += x.unmappedRevenueCents; t.sales += x.sales; return t;
      }, { revenueCents: 0, costCents: 0, profitCents: 0, unmappedRevenueCents: 0, sales: 0 });
      let cardFeeTotalCents = 0, cardTotalCents = 0;
      for (const x of dayList) {
        x.cardCents = cardByDate[x.date] || 0;
        x.cardFeeCents = Math.round(x.cardCents * cardFeePct / 100);
        cardTotalCents += x.cardCents; cardFeeTotalCents += x.cardFeeCents;
      }
      const overheadTotalCents = overheadCents * daysElapsed + cardFeeTotalCents;
      res.json({
        period, start, end, timezone: TZ, saleCount, overheadCents, daysElapsed, cardFeePct, cardTotalCents, cardFeeTotalCents,
        overheadTotalCents, days: dayList, items: itemList, totals: { ...totals, netProfitCents: totals.profitCents - overheadTotalCents }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Re-copy everything from the management site (replaces the costing data here; sales are untouched)
  r.post("/import", async (_req, res) => {
    try { res.json(await importFromSite()); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });

  // ---------- data copy ----------
  async function importFromSite() {
    const get = async p => {
      const x = await fetch(IMPORT_URL + p);
      if (!x.ok) throw new Error(`${IMPORT_URL}${p} returned ${x.status}`);
      return x.json();
    };
    const [ings, prods, mixes, maps, settings] = await Promise.all([
      get("/api/ingredients"), get("/api/products"), get("/api/mixes"), get("/api/mappings"), get("/api/settings")
    ]);
    if (!Array.isArray(ings) || !ings.length) throw new Error("The management site returned no ingredients");
    await prisma.$transaction(async tx => {
      await tx.posMap.deleteMany(); await tx.bomLine.deleteMany(); await tx.mixLine.deleteMany();
      await tx.mix.deleteMany(); await tx.product.deleteMany(); await tx.ingredient.deleteMany();
      const ingId = {};
      for (const g of ings) {
        const row = await tx.ingredient.create({ data: { ...ingFields(g), costPerUnit: g.costPerUnit ?? 0 } });
        ingId[g.code] = row.id;
      }
      const prodId = {};
      for (const p of prods) {
        const row = await tx.product.create({ data: { code: p.code, name: p.name, priceCents: p.priceCents ?? null } });
        prodId[p.code] = row.id;
        const lines = (p.bomLines || []).filter(l => l.ingredient && ingId[l.ingredient.code]).map(l => ({
          productId: row.id, ingredientId: ingId[l.ingredient.code], componentType: l.componentType || null, quantity: l.quantity || 0
        }));
        if (lines.length) await tx.bomLine.createMany({ data: lines });
      }
      for (const m of mixes) await tx.mix.create({ data: {
        name: m.name, linkedIngredientCode: m.linkedIngredientCode || null,
        lines: { create: (m.lines || []).map(l => ({ componentName: l.componentName, oz: l.oz ?? null, cost: l.cost ?? null })) }
      } });
      for (const m of maps) await tx.posMap.create({ data: {
        posName: m.posName, kind: m.kind || "product", productId: m.product ? prodId[m.product.code] ?? null : null
      } });
      for (const key of ["dailyOverheadCents", "cardFeePct"]) if (settings[key] != null) {
        const value = String(settings[key]);
        await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
    }, { timeout: 60000 });
    const out = { ok: true, source: IMPORT_URL, ingredients: ings.length, products: prods.length, mixes: mixes.length, mappings: maps.length };
    console.log("Costing data imported", out);
    return out;
  }

  // Spreadsheet seed (same file the management site was built from) if the live copy is unreachable.
  async function seedFromSheet() {
    const { ingredients, products, bom, posMaps, mixes } = require("../prisma/mgmt-data.js");
    for (const [code, name, unit, purchaseUnits, pricePerPU, costPerUnit, p1, p1p, p2, p2p] of ingredients)
      await prisma.ingredient.create({ data: { code, name, unit, purchaseUnits: purchaseUnits ?? null, pricePerPU: pricePerPU ?? null,
        costPerUnit: costPerUnit ?? 0, provider1: p1 ?? null, provider1Price: p1p ?? null, provider2: p2 ?? null, provider2Price: p2p ?? null } });
    for (const [code, name, priceCents] of products) await prisma.product.create({ data: { code, name, priceCents } });
    const ing = Object.fromEntries((await prisma.ingredient.findMany()).map(i => [i.code, i.id]));
    const prod = Object.fromEntries((await prisma.product.findMany()).map(p => [p.code, p.id]));
    for (const [pc, type, ic, qty] of bom) if (prod[pc] && ing[ic])
      await prisma.bomLine.create({ data: { productId: prod[pc], ingredientId: ing[ic], componentType: type || null, quantity: qty || 0 } });
    for (const [posName, kind, pc] of posMaps)
      await prisma.posMap.create({ data: { posName, kind, productId: pc ? prod[pc] ?? null : null } });
    for (const m of mixes) await prisma.mix.create({ data: { name: m.name, linkedIngredientCode: m.linkedIngredientCode,
      lines: { create: m.lines.map(([componentName, oz, cost]) => ({ componentName, oz, cost })) } } });
    for (const [key, value] of [["dailyOverheadCents", "20000"], ["cardFeePct", "8.25"]])
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
    console.log("Costing data seeded from spreadsheet copy");
  }

  // First boot: copy the live management data once; fall back to the spreadsheet seed.
  async function ensureData() {
    try {
      if (await prisma.ingredient.count()) return;
      try { await importFromSite(); }
      catch (e) { console.error("Live import failed, using spreadsheet seed:", e.message); await seedFromSheet(); }
    } catch (e) { console.error("Costing data setup failed", e.message); }
  }

  // Unit cost in cents for each sold item name, from its BOM mapping (used by the Ventas ledger).
  // Returns { name: cents } only for mapped names; unmapped names fall back to manual costs.
  async function unitCostCentsByName(names) {
    const [maps, costs] = await Promise.all([prisma.posMap.findMany({ where: { posName: { in: names } } }), bomCostByProductId()]);
    const out = {};
    for (const m of maps) {
      if (m.kind === "zerocost" || m.kind === "ignore") out[m.posName] = 0;
      else if (m.productId) out[m.posName] = Math.round((costs[m.productId] || 0) * 100);
    }
    return out;
  }
  r.get("/unit-costs", async (_req, res) => {
    const maps = await prisma.posMap.findMany({ include: { product: true } });
    const costs = await unitCostCentsByName(maps.map(m => m.posName));
    res.json(Object.fromEntries(maps.map(m => [m.posName, {
      cents: costs[m.posName] ?? null, kind: m.kind, product: m.product ? `${m.product.code} ${m.product.name}` : null
    }])));
  });

  return { router: r, ensureData, unitCostCentsByName };
};
