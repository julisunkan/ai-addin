import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LICENSES_FILE = join(__dirname, "../data/licenses.json");
const SETTINGS_FILE = join(__dirname, "../data/settings.json");

const router = Router();

function requireAdmin(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return res.status(503).json({ error: "ADMIN_PASSWORD not configured on server" });
  if (req.headers["x-admin-password"] !== password) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function loadLicenses() {
  try { return JSON.parse(readFileSync(LICENSES_FILE, "utf8")); } catch { return []; }
}

function saveLicenses(licenses) {
  writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
}

function generateLicenseKey() {
  return "AIFG-" + randomBytes(12).toString("hex").toUpperCase();
}

function computeExpiresAt(expiryDays) {
  if (!expiryDays || expiryDays <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + parseInt(expiryDays));
  return d.toISOString();
}

// GET /api/admin/licenses
router.get("/licenses", requireAdmin, (req, res) => {
  const licenses = loadLicenses();
  res.json({
    total: licenses.length,
    licenses: licenses.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()),
  });
});

// POST /api/admin/licenses/generate
router.post("/licenses/generate", requireAdmin, (req, res) => {
  const { note, expiryDays } = req.body || {};
  const licenseKey = generateLicenseKey();
  const expiresAt = computeExpiresAt(expiryDays);
  const licenses = loadLicenses();
  licenses.push({
    licenseKey,
    txHash:   "MANUAL",
    note:     (note || "Admin generated").slice(0, 100),
    issuedAt: new Date().toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  });
  saveLicenses(licenses);
  console.log(`🔑 Manual license issued: ${licenseKey}${note ? ` (${note})` : ""}${expiresAt ? ` expires ${expiresAt}` : ""}`);
  res.json({ licenseKey, expiresAt });
});

// POST /api/admin/licenses/bulk-generate
router.post("/licenses/bulk-generate", requireAdmin, (req, res) => {
  const { count = 1, note, expiryDays } = req.body || {};
  const n = Math.max(1, Math.min(100, parseInt(count) || 1));
  const expiresAt = computeExpiresAt(expiryDays);
  const licenses = loadLicenses();
  const now = new Date().toISOString();
  const newKeys = [];
  for (let i = 0; i < n; i++) {
    const licenseKey = generateLicenseKey();
    licenses.push({
      licenseKey,
      txHash:   "MANUAL",
      note:     (note || "Bulk generated").slice(0, 100),
      issuedAt: now,
      ...(expiresAt ? { expiresAt } : {}),
    });
    newKeys.push(licenseKey);
  }
  saveLicenses(licenses);
  console.log(`🔑 Bulk issued ${n} license(s)${note ? ` (${note})` : ""}`);
  res.json({ keys: newKeys, count: newKeys.length, expiresAt });
});

// GET /api/admin/revenue
router.get("/revenue", requireAdmin, (req, res) => {
  const licenses = loadLicenses();
  const now = Date.now();
  const paid   = licenses.filter(l => l.txHash !== "MANUAL");
  const active = licenses.filter(l => !l.expiresAt || new Date(l.expiresAt).getTime() > now);
  const totalRevenue = paid.length * 1; // 1 USDT per license

  // Monthly breakdown — last 13 months
  const monthlyMap = {};
  for (let i = 12; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = { month: key, activations: 0, revenue: 0 };
  }
  for (const l of paid) {
    const d = new Date(l.issuedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap[key]) { monthlyMap[key].activations++; monthlyMap[key].revenue += 1; }
  }

  res.json({
    totalRevenue,
    mrr: 0,
    totalLicenses:  licenses.length,
    activeLicenses: active.length,
    paidLicenses:   paid.length,
    withEmail:      licenses.filter(l => l.email).length,
    monthly:        Object.values(monthlyMap),
  });
});

// DELETE /api/admin/licenses/:key
router.delete("/licenses/:key", requireAdmin, (req, res) => {
  const { key } = req.params;
  const licenses = loadLicenses();
  const updated = licenses.filter(l => l.licenseKey !== key);
  if (updated.length === licenses.length) return res.status(404).json({ error: "License not found" });
  saveLicenses(updated);
  console.log(`🗑  License revoked: ${key}`);
  res.json({ ok: true });
});

export default router;
