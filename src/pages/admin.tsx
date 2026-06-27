import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound, LogOut, RefreshCw, ShieldCheck, Copy, Check,
  Save, Eye, EyeOff, Download, AlertCircle, CheckCircle2,
  Users, DollarSign, Activity, BarChart3, Bot, CreditCard, Palette, Zap,
  MessageSquare, ChevronDown, ChevronUp, Trash2, Send, X
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface License {
  licenseKey: string;
  txHash:     string;
  issuedAt:   string;
  note?:      string;
  expiresAt?: string;
  email?:     string | null;
}

interface Settings {
  appearance: { name: string; tagline: string; primaryColor: string; accentColor: string; radius: string };
  payment:    { walletAddress: string; network: string };
  groq:       { model: string; hasApiKey: boolean };
  features:   { proEnabled: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw]       = useState("");
  const [show, setShow]   = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: { "x-admin-password": pw },
      });
      setLoading(false);
      if (res.status === 401) { setError("Wrong password."); return; }
      if (res.status === 503) { setError("ADMIN_PASSWORD not configured on the server."); return; }
      if (!res.ok) { setError(`Server error (${res.status})`); return; }
      sessionStorage.setItem("admin_pw", pw);
      onLogin(pw);
    } catch {
      setLoading(false);
      setError("Network error — cannot reach the backend.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <CardTitle className="text-lg">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">AI Formula Generator</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder="Admin password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoFocus
                className="pr-10"
                data-testid="input-admin-password"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !pw} data-testid="button-admin-login">
              {loading ? "Checking…" : "Login"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Set <code className="bg-muted px-1 rounded">ADMIN_PASSWORD</code> as a Replit Secret
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ pw }: { pw: string }) {
  const [data, setData] = useState<{
    totalRevenue: number; mrr: number; totalLicenses: number;
    activeLicenses: number; paidLicenses: number; withEmail: number;
    monthly: { month: string; activations: number; revenue: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/revenue`, { headers: { "x-admin-password": pw } });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const stats = data ? [
    { label: "Total Revenue",   value: `$${data.totalRevenue.toFixed(2)} USDT`, icon: DollarSign, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Total Licenses",  value: data.totalLicenses,  icon: Users,      color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200"  },
    { label: "Active Licenses", value: data.activeLicenses, icon: Activity,   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200"   },
    { label: "Paid Licenses",   value: data.paidLicenses,   icon: BarChart3,  color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Revenue Overview</h3>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
              <div key={s.label} className={`rounded-xl border ${s.bg} px-4 py-3`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Monthly Activations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.monthly.slice(-6).map(m => {
                  const maxAct = Math.max(...data.monthly.map(x => x.activations), 1);
                  const barW = Math.round((m.activations / maxAct) * 100);
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                        <div style={{ width: `${barW}%` }} className="h-full bg-indigo-500 rounded-md transition-all" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground w-6 text-right">{m.activations}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
      )}
    </div>
  );
}

// ── Licenses Tab ──────────────────────────────────────────────────────────────

function LicensesTab({ pw }: { pw: string }) {
  const [data, setData] = useState<{ total: number; licenses: License[] } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote]     = useState("");
  const [genExpiry, setGenExpiry] = useState("0");
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [newKeyCopied, setNewKeyCopied] = useState(false);
  const [revoking, setRevoking]   = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkNote, setBulkNote]   = useState("");
  const [bulkExpiry, setBulkExpiry] = useState("0");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkKeys, setBulkKeys]   = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/licenses`, { headers: { "x-admin-password": pw } });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function generateKey() {
    setGenerating(true); setNewKey(null);
    const res = await fetch(`${API_BASE}/api/admin/licenses/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ note: genNote || "Admin generated", expiryDays: parseInt(genExpiry) || 0 }),
    });
    setGenerating(false);
    if (res.ok) { const { licenseKey } = await res.json(); setNewKey(licenseKey); setGenNote(""); load(); }
  }

  async function bulkGenerate() {
    setBulkGenerating(true); setBulkKeys([]);
    const res = await fetch(`${API_BASE}/api/admin/licenses/bulk-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ count: bulkCount, note: bulkNote || "Bulk generated", expiryDays: parseInt(bulkExpiry) || 0 }),
    });
    setBulkGenerating(false);
    if (res.ok) { const { keys } = await res.json(); setBulkKeys(keys); load(); }
  }

  function downloadCsv() {
    if (!bulkKeys.length) return;
    const csv = ["License Key,Note,Generated At"].concat(
      bulkKeys.map(k => `${k},"${bulkNote || "Bulk generated"}",${new Date().toISOString()}`)
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `aifg-licenses-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function revokeKey(key: string) {
    if (!confirm(`Revoke ${key}? This cannot be undone.`)) return;
    setRevoking(key);
    await fetch(`${API_BASE}/api/admin/licenses/${encodeURIComponent(key)}`, {
      method: "DELETE", headers: { "x-admin-password": pw },
    });
    setRevoking(null); load();
  }

  function exportCsv() {
    if (!data) return;
    const header = ["License Key","Source / TX Hash","Email","Issued At","Expires At","Note"];
    const rows = data.licenses.map(l => [
      l.licenseKey, l.txHash === "MANUAL" ? "Manual" : l.txHash,
      l.email ?? "", l.issuedAt ?? "", l.expiresAt ?? "", l.note ?? "",
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `aifg-subscribers-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Generate */}
      <Card className="border-indigo-100 bg-indigo-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" /> Generate License Key
          </CardTitle>
          <p className="text-sm text-muted-foreground">Create a key manually — for testing or granting free access.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input value={genNote} onChange={e => setGenNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-[140px]" onKeyDown={e => e.key === "Enter" && generateKey()} />
            <select value={genExpiry} onChange={e => setGenExpiry(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none shrink-0">
              <option value="0">No expiry</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
            <Button onClick={generateKey} disabled={generating} className="gap-2 shrink-0" data-testid="button-generate-key">
              {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><KeyRound className="w-4 h-4" /> Generate</>}
            </Button>
          </div>
          {newKey && (
            <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2.5">
              <code className="flex-1 text-sm font-mono font-bold text-foreground tracking-wider select-all" data-testid="text-new-key">{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); setNewKeyCopied(true); setTimeout(() => setNewKeyCopied(false), 2000); }}
                className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                {newKeyCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk generate */}
      <Card className="border-purple-100 bg-purple-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-purple-600" /> Bulk Generate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium">Count</label>
              <Input type="number" min={1} max={100} value={bulkCount}
                onChange={e => setBulkCount(Math.max(1, Math.min(100, parseInt(e.target.value)||1)))} className="w-20" />
            </div>
            <Input value={bulkNote} onChange={e => setBulkNote(e.target.value)} placeholder="Note (optional)" className="flex-1 min-w-[140px]" />
            <select value={bulkExpiry} onChange={e => setBulkExpiry(e.target.value)} className="rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none shrink-0">
              <option value="0">No expiry</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
            <Button onClick={bulkGenerate} disabled={bulkGenerating} variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0">
              {bulkGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><KeyRound className="w-4 h-4" /> Generate {bulkCount}</>}
            </Button>
          </div>
          {bulkKeys.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-700">✓ {bulkKeys.length} keys generated</p>
                <Button onClick={downloadCsv} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </Button>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-purple-200 bg-white">
                {bulkKeys.map((k, i) => (
                  <div key={k} className="flex items-center justify-between px-3 py-1.5 border-b border-purple-50 last:border-0">
                    <span className="text-xs text-muted-foreground w-5">{i+1}</span>
                    <code className="flex-1 text-xs font-mono font-medium select-all">{k}</code>
                    <CopyBtn text={k} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{data?.total ?? 0} licenses total</Badge>
        <div className="flex items-center gap-2">
          {data && data.licenses.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!data || data.licenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No licenses issued yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/60">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">License Key</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expiry</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.licenses.map((l, i) => {
                    const now = Date.now();
                    const exp = l.expiresAt ? new Date(l.expiresAt).getTime() : null;
                    const expired = exp !== null && exp < now;
                    return (
                      <tr key={l.licenseKey} data-testid={`row-license-${l.licenseKey}`}
                        className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${expired ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground">{i+1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded" data-testid={`text-license-key-${i}`}>{l.licenseKey}</code>
                            <CopyBtn text={l.licenseKey} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {l.txHash === "MANUAL"
                            ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0">Manual{l.note ? ` — ${l.note}` : ""}</Badge>
                            : <div className="flex items-center gap-1 max-w-[140px]">
                                <span className="font-mono text-xs text-muted-foreground truncate">{l.txHash.slice(0,16)}…</span>
                                <CopyBtn text={l.txHash} />
                              </div>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {l.email
                            ? <span className="text-xs">{l.email}</span>
                            : <span className="text-xs text-muted-foreground/50 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!l.expiresAt
                            ? <span className="text-xs text-muted-foreground">Lifetime</span>
                            : expired
                            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Expired</span>
                            : <span className="text-xs text-muted-foreground">{fmtDate(l.expiresAt)}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.issuedAt)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => revokeKey(l.licenseKey)} disabled={revoking === l.licenseKey}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40" title="Revoke">
                            {revoking === l.licenseKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "✕"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ pw, settings, onSaved }: { pw: string; settings: Settings; onSaved: () => void }) {
  // AI / Groq state
  const [groqKey, setGroqKey]   = useState("");
  const [groqModel, setGroqModel] = useState(settings.groq?.model || "llama-3.3-70b-versatile");
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savingGroq, setSavingGroq]   = useState(false);
  const [savedGroq, setSavedGroq]     = useState(false);
  const [hasGroqKey, setHasGroqKey]   = useState(settings.groq?.hasApiKey ?? false);

  // Payment state
  const [payment, setPayment]   = useState(settings.payment);
  const [savingPay, setSavingPay] = useState(false);
  const [savedPay, setSavedPay]   = useState(false);

  // Appearance state
  const [appearance, setAppearance] = useState(settings.appearance);
  const [savingApp, setSavingApp]   = useState(false);
  const [savedApp, setSavedApp]     = useState(false);

  useEffect(() => {
    setPayment(settings.payment);
    setAppearance(settings.appearance);
    setGroqModel(settings.groq?.model || "llama-3.3-70b-versatile");
    setHasGroqKey(settings.groq?.hasApiKey ?? false);
  }, [settings]);

  async function patchSettings(patch: object, setSaving: (b: boolean) => void, setSaved: (b: boolean) => void) {
    setSaving(true);
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved(); }
  }

  async function saveGroq() {
    const patch: Record<string,unknown> = { groq: { model: groqModel } };
    if (groqKey.trim()) patch.groq = { ...(patch.groq as object), apiKey: groqKey.trim() };
    await patchSettings(patch, setSavingGroq, setSavedGroq);
    if (groqKey.trim()) { setHasGroqKey(true); setGroqKey(""); }
  }

  const RADIUS_OPTIONS = ["2px","4px","6px","8px","12px"];
  const GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ];

  return (
    <div className="space-y-5">
      {/* AI Settings */}
      <Card className="border-indigo-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-600" /> AI Settings (Groq)
          </CardTitle>
          <p className="text-sm text-muted-foreground">Configure the Groq API used to generate Excel formulas.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Groq API Key</label>
            {hasGroqKey && !groqKey && (
              <div className="flex items-center gap-2 mb-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> API key is configured. Enter a new key below to replace it.
              </div>
            )}
            {!hasGroqKey && (
              <div className="flex items-start gap-2 mb-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  No API key set. Get one free at{" "}
                  <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="underline font-semibold">console.groq.com</a>.
                  You can also set <code className="bg-amber-100 rounded px-1">GROQ_API_KEY</code> as a Replit Secret.
                </div>
              </div>
            )}
            <div className="relative">
              <Input
                type={showGroqKey ? "text" : "password"}
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder={hasGroqKey ? "Enter new key to replace existing…" : "gsk_…"}
                className="pr-10 font-mono text-sm"
                data-testid="input-groq-api-key"
              />
              <button type="button" onClick={() => setShowGroqKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Model</label>
            <select value={groqModel} onChange={e => setGroqModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="select-groq-model">
              {GROQ_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Recommended: <strong>llama-3.3-70b-versatile</strong> for best formula quality.</p>
          </div>
          <Button onClick={saveGroq} disabled={savingGroq} className="gap-2" data-testid="button-save-groq">
            {savedGroq ? <><Check className="w-4 h-4" /> Saved!</> : savingGroq ? "Saving…" : <><Save className="w-4 h-4" /> Save AI Settings</>}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payment Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">Users pay 1 USDT to unlock formula results.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">USDT Wallet Address</label>
            <Input value={payment.walletAddress} onChange={e => setPayment(f => ({ ...f, walletAddress: e.target.value }))}
              placeholder="Your USDT wallet address" className="font-mono text-sm" data-testid="input-wallet-address" />
            <p className="text-xs text-muted-foreground mt-1">Users send 1 USDT to this address to unlock.</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Network</label>
            <select value={payment.network} onChange={e => setPayment(f => ({ ...f, network: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="select-network">
              <option value="tron">Tron (TRC-20) — Recommended, near-zero fees</option>
              <option value="bsc">BNB Smart Chain (BEP-20) — Low fees</option>
              <option value="eth">Ethereum (ERC-20) — Higher fees</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground bg-muted rounded-md p-3">
            For higher blockchain API rate limits, set <code className="bg-background rounded px-1">TRONGRID_API_KEY</code>, <code className="bg-background rounded px-1">BSCSCAN_API_KEY</code>, or <code className="bg-background rounded px-1">ETHERSCAN_API_KEY</code> as Replit Secrets.
          </div>
          <Button onClick={() => patchSettings({ payment }, setSavingPay, setSavedPay)} disabled={savingPay} className="gap-2" data-testid="button-save-payment">
            {savedPay ? <><Check className="w-4 h-4" /> Saved!</> : savingPay ? "Saving…" : <><Save className="w-4 h-4" /> Save Payment Settings</>}
          </Button>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Add-in Name</label>
              <Input value={appearance.name} onChange={e => setAppearance(a => ({ ...a, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tagline</label>
              <Input value={appearance.tagline} onChange={e => setAppearance(a => ({ ...a, tagline: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Primary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={appearance.primaryColor} onChange={e => setAppearance(a => ({ ...a, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-input p-0.5" />
                <Input value={appearance.primaryColor} onChange={e => setAppearance(a => ({ ...a, primaryColor: e.target.value }))} className="font-mono flex-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={appearance.accentColor} onChange={e => setAppearance(a => ({ ...a, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-input p-0.5" />
                <Input value={appearance.accentColor} onChange={e => setAppearance(a => ({ ...a, accentColor: e.target.value }))} className="font-mono flex-1" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Border Radius</label>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map(r => (
                <button key={r} onClick={() => setAppearance(a => ({ ...a, radius: r }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${appearance.radius === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => patchSettings({ appearance }, setSavingApp, setSavedApp)} disabled={savingApp} className="gap-2">
            {savedApp ? <><Check className="w-4 h-4" /> Saved!</> : savingApp ? "Saving…" : <><Save className="w-4 h-4" /> Save Appearance</>}
          </Button>
        </CardContent>
      </Card>

      {/* Export / Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={async () => {
            const res = await fetch(`${API_BASE}/api/admin/export`, { headers: { "x-admin-password": pw } });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `aifg-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
          }}>
            <Download className="w-4 h-4" /> Export Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tickets Tab ───────────────────────────────────────────────────────────────

interface Ticket {
  id:         string;
  name:       string | null;
  email:      string;
  licenseKey: string | null;
  category:   string;
  subject:    string;
  message:    string;
  status:     "open" | "resolved" | "closed";
  createdAt:  string;
  adminReply: string | null;
  repliedAt:  string | null;
}

const STATUS_COLORS: Record<string, string> = {
  open:     "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed:   "bg-gray-100 text-gray-500 border-gray-200",
};

function TicketsTab({ pw }: { pw: string }) {
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [replyText, setReplyText]   = useState<Record<string, string>>({});
  const [replying, setReplying]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [saving, setSaving]         = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const query = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    const res = await fetch(`${API_BASE}/api/tickets${query}`, { headers: { "x-admin-password": pw } });
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets);
      setTotal(data.total);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterStatus]);

  async function sendReply(ticket: Ticket) {
    const reply = replyText[ticket.id]?.trim();
    if (!reply) return;
    setReplying(ticket.id);
    const res = await fetch(`${API_BASE}/api/tickets/${ticket.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body:    JSON.stringify({ adminReply: reply }),
    });
    setReplying(null);
    if (res.ok) {
      setReplyText(r => ({ ...r, [ticket.id]: "" }));
      load();
    }
  }

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    await fetch(`${API_BASE}/api/tickets/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body:    JSON.stringify({ status }),
    });
    setSaving(null);
    load();
  }

  async function deleteTicket(id: string) {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`${API_BASE}/api/tickets/${id}`, {
      method: "DELETE", headers: { "x-admin-password": pw },
    });
    setDeleting(null);
    if (expanded === id) setExpanded(null);
    load();
  }

  const openCount     = tickets.filter(t => t.status === "open").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-base font-semibold">Support Tickets</h3>
          <div className="flex gap-2">
            {openCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                {openCount} open
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {resolvedCount} resolved
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none"
            data-testid="select-ticket-filter"
          >
            <option value="all">All ({total})</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!loading && tickets.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <MessageSquare className="w-10 h-10 text-indigo-200" />
            <p className="text-sm font-semibold text-muted-foreground">No tickets yet</p>
            <p className="text-xs text-muted-foreground">Support messages submitted by users will appear here.</p>
          </CardContent>
        </Card>
      )}

      {/* Ticket list */}
      <div className="space-y-3">
        {tickets.map(ticket => {
          const isOpen = expanded === ticket.id;
          const reply  = replyText[ticket.id] ?? "";

          return (
            <Card
              key={ticket.id}
              data-testid={`card-ticket-${ticket.id}`}
              className={`overflow-hidden transition-shadow ${isOpen ? "shadow-md" : "shadow-sm"}`}
            >
              {/* Ticket header — always visible */}
              <button
                onClick={() => setExpanded(isOpen ? null : ticket.id)}
                className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-[10px] font-mono font-bold text-muted-foreground">{ticket.id}</code>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.closed}`}>
                        {ticket.status}
                      </span>
                      {ticket.adminReply && (
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                          replied
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{ticket.subject || "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.email}
                      {ticket.licenseKey ? <span className="ml-2 font-mono text-[10px] text-indigo-500">{ticket.licenseKey}</span> : null}
                      <span className="mx-1.5">·</span>
                      {fmtDate(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); deleteTicket(ticket.id); }}
                      disabled={deleting === ticket.id}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 p-1 rounded hover:bg-red-50"
                      title="Delete ticket"
                      data-testid={`button-delete-ticket-${ticket.id}`}
                    >
                      {deleting === ticket.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-border">
                  {/* User message */}
                  <div className="px-4 py-4 bg-gray-50/50 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">User Message</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
                  </div>

                  {/* Existing reply */}
                  {ticket.adminReply && (
                    <div className="px-4 py-4 bg-indigo-50/50 border-t border-indigo-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Your Reply</p>
                        {ticket.repliedAt && <p className="text-[10px] text-muted-foreground">{fmtDate(ticket.repliedAt)}</p>}
                      </div>
                      <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{ticket.adminReply}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 py-4 border-t border-border space-y-3">
                    {/* Status control */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                      {(["open", "resolved", "closed"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(ticket.id, s)}
                          disabled={saving === ticket.id || ticket.status === s}
                          data-testid={`button-status-${ticket.id}-${s}`}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:cursor-default ${
                            ticket.status === s
                              ? STATUS_COLORS[s]
                              : "bg-white text-muted-foreground border-border hover:bg-gray-50"
                          }`}
                        >
                          {saving === ticket.id ? "…" : s}
                        </button>
                      ))}
                    </div>

                    {/* Reply box */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {ticket.adminReply ? "Update Reply" : "Write a Reply"}
                        <span className="font-normal ml-1">(note: reply is stored but not emailed automatically)</span>
                      </p>
                      <textarea
                        value={reply}
                        onChange={e => setReplyText(r => ({ ...r, [ticket.id]: e.target.value }))}
                        placeholder="Type your reply to the user…"
                        rows={3}
                        data-testid={`input-reply-${ticket.id}`}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => sendReply(ticket)}
                          disabled={!reply.trim() || replying === ticket.id}
                          className="gap-2"
                          data-testid={`button-reply-${ticket.id}`}
                        >
                          {replying === ticket.id
                            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                            : <><Send className="w-3.5 h-3.5" /> Save Reply & Mark Resolved</>}
                        </Button>
                        {reply && (
                          <Button size="sm" variant="ghost" onClick={() => setReplyText(r => ({ ...r, [ticket.id]: "" }))}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────

type Tab = "overview" | "licenses" | "settings" | "tickets";

export default function AdminPage() {
  const [pw, setPw]             = useState<string | null>(sessionStorage.getItem("admin_pw"));
  const [tab, setTab]           = useState<Tab>("overview");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  async function loadSettings(password: string) {
    setLoadingSettings(true);
    const res = await fetch(`${API_BASE}/api/admin/settings`, { headers: { "x-admin-password": password } });
    if (res.ok) setSettings(await res.json());
    setLoadingSettings(false);
  }

  function handleLogin(password: string) {
    setPw(password);
    loadSettings(password);
  }

  useEffect(() => {
    if (pw) loadSettings(pw);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("admin_pw");
    setPw(null);
    setSettings(null);
  }

  if (!pw) return <LoginScreen onLogin={handleLogin} />;

  const TABS: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview",  label: "Overview",  icon: BarChart3     },
    { id: "licenses",  label: "Licenses",  icon: KeyRound      },
    { id: "tickets",   label: "Support",   icon: MessageSquare },
    { id: "settings",  label: "Settings",  icon: Zap           },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">AI Formula Generator</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Admin Dashboard</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "overview"  && <OverviewTab pw={pw} />}
        {tab === "licenses"  && <LicensesTab pw={pw} />}
        {tab === "tickets"   && <TicketsTab  pw={pw} />}
        {tab === "settings"  && settings && (
          <SettingsTab pw={pw} settings={settings} onSaved={() => loadSettings(pw)} />
        )}
        {tab === "settings" && loadingSettings && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading settings…
          </div>
        )}
      </main>
    </div>
  );
}
