import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, "../data/settings.json");
const LICENSES_FILE = join(__dirname, "../data/licenses.json");

const router = Router();

const DEFAULT_SETTINGS = {
  appearance: {
    name: "AI Formula Generator",
    tagline: "Describe what you want in plain English — get the perfect Excel formula instantly.",
    primaryColor: "#6366f1",
    accentColor: "#10b981",
    radius: "8px",
  },
  payment: { walletAddress: "", network: "tron" },
  groq: { apiKey: "", model: "llama-3.3-70b-versatile" },
  notifications: {
    webhookUrl: "",
    email: { enabled: false, to: "", smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", from: "" },
  },
  features: { proEnabled: true },
};

function loadSettings() {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      appearance:    { ...DEFAULT_SETTINGS.appearance,    ...(raw.appearance    || {}) },
      payment:       { ...DEFAULT_SETTINGS.payment,       ...(raw.payment       || {}) },
      groq:          { ...DEFAULT_SETTINGS.groq,          ...(raw.groq          || {}) },
      notifications: {
        webhookUrl: raw.notifications?.webhookUrl ?? "",
        email: { ...DEFAULT_SETTINGS.notifications.email, ...(raw.notifications?.email || {}) },
      },
      features: { ...DEFAULT_SETTINGS.features, ...(raw.features || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s) {
  writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function loadLicenses() {
  try { return JSON.parse(readFileSync(LICENSES_FILE, "utf8")); } catch { return []; }
}

function saveLicenses(l) {
  writeFileSync(LICENSES_FILE, JSON.stringify(l, null, 2));
}

function requireAdmin(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return res.status(503).json({ error: "ADMIN_PASSWORD not configured" });
  if (req.headers["x-admin-password"] !== password) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// GET /api/config  (public — frontend loads on startup)
router.get("/", (req, res) => {
  const s = loadSettings();
  res.json({
    appearance: s.appearance,
    features:   s.features,
    payment:    { network: s.payment.network },
  });
});

// GET /api/admin/settings
router.get("/settings", requireAdmin, (req, res) => {
  const s = loadSettings();
  // Never expose the raw groq key to the UI — send a masked flag
  res.json({
    ...s,
    groq: {
      model: s.groq.model,
      hasApiKey: Boolean(s.groq.apiKey || process.env.GROQ_API_KEY),
    },
  });
});

// PUT /api/admin/settings
router.put("/settings", requireAdmin, (req, res) => {
  const current = loadSettings();
  const patch = req.body || {};
  const patchEmail = patch.notifications?.email || {};

  const merged = {
    appearance:    { ...current.appearance,    ...(patch.appearance    || {}) },
    payment:       { ...current.payment,       ...(patch.payment       || {}) },
    groq:          {
      apiKey: patch.groq?.apiKey !== undefined ? patch.groq.apiKey : current.groq.apiKey,
      model:  patch.groq?.model  !== undefined ? patch.groq.model  : current.groq.model,
    },
    notifications: {
      webhookUrl: patch.notifications?.webhookUrl ?? current.notifications?.webhookUrl ?? "",
      email: { ...current.notifications?.email, ...patchEmail },
    },
    features: { ...current.features, ...(patch.features || {}) },
  };

  if (!merged.payment.walletAddress) {
    merged.payment.walletAddress = process.env.USDT_WALLET_ADDRESS || "";
  }

  saveSettings(merged);
  res.json({ ok: true });
});

// GET /api/admin/export
router.get("/export", requireAdmin, (req, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    licenses: loadLicenses(),
  };
  res.setHeader("Content-Disposition", `attachment; filename="aifg-backup-${Date.now()}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(backup);
});

// POST /api/admin/import
router.post("/import", requireAdmin, (req, res) => {
  const { settings, licenses } = req.body || {};
  if (settings) saveSettings(settings);
  if (Array.isArray(licenses)) saveLicenses(licenses);
  res.json({ ok: true });
});

export default router;
