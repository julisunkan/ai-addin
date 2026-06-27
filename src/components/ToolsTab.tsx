import { useState, useCallback } from "react";
import {
  Bug, Zap, ArrowLeftRight, Globe, Tag, BarChart3,
  Loader2, AlertCircle, Copy, Check, Lock, ChevronDown,
  Code2, RefreshCw
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish", "Turkish", "Swedish",
];

const MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B — Best Quality" },
  { value: "llama-3.1-8b-instant",    label: "Llama 3.1 8B — Fastest" },
  { value: "gemma2-9b-it",            label: "Gemma 2 9B — Google" },
  { value: "llama3-70b-8192",         label: "Llama 3 70B — Stable" },
];

type ToolId = "debug" | "optimize" | "convert" | "explain" | "named-ranges" | "analyze";

const TOOLS: { id: ToolId; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: "debug",        icon: <Bug className="w-3.5 h-3.5" />,          label: "Debug",         desc: "Find and fix errors" },
  { id: "optimize",     icon: <Zap className="w-3.5 h-3.5" />,          label: "Optimize",      desc: "Improve performance" },
  { id: "convert",      icon: <ArrowLeftRight className="w-3.5 h-3.5" />, label: "Convert",     desc: "Formula ↔ VBA" },
  { id: "explain",      icon: <Globe className="w-3.5 h-3.5" />,        label: "Explain",       desc: "Multi-language" },
  { id: "named-ranges", icon: <Tag className="w-3.5 h-3.5" />,          label: "Named Ranges",  desc: "Auto-suggestions" },
  { id: "analyze",      icon: <BarChart3 className="w-3.5 h-3.5" />,    label: "Analyze",       desc: "Workbook AI review" },
];

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10 gap-2">
      <Lock className="w-5 h-5 text-indigo-400" />
      <p className="text-xs text-indigo-700 font-semibold">Premium feature</p>
      <button
        onClick={onUnlock}
        className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-bold hover:bg-indigo-700 transition-colors"
      >
        Unlock with License
      </button>
    </div>
  );
}

function ResultBox({ children, isLicensed, onUnlock }: { children: React.ReactNode; isLicensed: boolean; onUnlock: () => void }) {
  return (
    <div className="relative">
      <div className={!isLicensed ? "blur-sm select-none pointer-events-none" : ""}>{children}</div>
      {!isLicensed && <LockOverlay onUnlock={onUnlock} />}
    </div>
  );
}

// ── Debug Tool ────────────────────────────────────────────────────────────────
function DebugTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [formula, setFormula] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  async function run() {
    if (!formula.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula: formula.trim(), errorMessage: errorMsg.trim() || undefined, model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to debug formula."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const issues = Array.isArray(result?.issues) ? result.issues as string[] : [];
  const fixes = Array.isArray(result?.fixes) ? result.fixes as { problem: string; solution: string; correctedPart?: string }[] : [];
  const tips = Array.isArray(result?.preventionTips) ? result.preventionTips as string[] : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Formula to Debug</label>
        <textarea
          value={formula}
          onChange={e => setFormula(e.target.value)}
          placeholder="=VLOOKUP(A1,B:C,2,0)"
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Error Message (optional)</label>
        <input
          value={errorMsg}
          onChange={e => setErrorMsg(e.target.value)}
          placeholder="#N/A, #VALUE!, #REF!, etc."
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <button
        onClick={run}
        disabled={loading || !formula.trim()}
        className="w-full flex items-center justify-center gap-2 bg-rose-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Debugging…</> : <><Bug className="w-4 h-4" /> Debug Formula</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            {issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1.5">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Issues Found</p>
                {issues.map((issue, i) => <p key={i} className="text-sm text-red-800">• {issue}</p>)}
              </div>
            )}
            {result.correctedFormula && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Corrected Formula</p>
                  <button onClick={() => copy(result.correctedFormula as string)} className="text-xs flex items-center gap-1 text-emerald-700 hover:text-emerald-900">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <code className="block text-sm font-mono font-bold text-emerald-900 break-all">{result.correctedFormula as string}</code>
              </div>
            )}
            {fixes.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3.5 py-2.5 bg-gray-50 border-b border-border">Fixes Applied</p>
                {fixes.map((fix, i) => (
                  <div key={i} className={`px-3.5 py-3 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} border-b border-border last:border-0`}>
                    <p className="text-xs font-semibold text-red-600">Problem: {fix.problem}</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Fix: {fix.solution}</p>
                    {fix.correctedPart && <code className="text-[11px] font-mono text-indigo-700 mt-1 block">{fix.correctedPart}</code>}
                  </div>
                ))}
              </div>
            )}
            {result.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Explanation</p>
                <p className="text-sm text-blue-900">{result.explanation as string}</p>
              </div>
            )}
            {tips.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prevention Tips</p>
                {tips.map((tip, i) => <p key={i} className="text-xs text-muted-foreground">✓ {tip}</p>)}
              </div>
            )}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Optimize Tool ─────────────────────────────────────────────────────────────
function OptimizeTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [formula, setFormula] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  async function run() {
    if (!formula.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula: formula.trim(), context: context.trim() || undefined, model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to optimize."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const improvements = Array.isArray(result?.improvements) ? result.improvements as string[] : [];
  const alternatives = Array.isArray(result?.alternativeApproaches) ? result.alternativeApproaches as string[] : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Formula to Optimize</label>
        <textarea
          value={formula}
          onChange={e => setFormula(e.target.value)}
          placeholder="Paste your formula here to optimize it"
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Context (optional)</label>
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="e.g. Used in a large table with 10k rows"
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <button
        onClick={run}
        disabled={loading || !formula.trim()}
        className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Optimizing…</> : <><Zap className="w-4 h-4" /> Optimize Formula</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            {result.optimizedFormula && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Optimized Formula</p>
                  <button onClick={() => copy(result.optimizedFormula as string)} className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-900">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <code className="block text-sm font-mono font-bold text-amber-900 break-all">{result.optimizedFormula as string}</code>
              </div>
            )}
            {improvements.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Improvements Made</p>
                {improvements.map((imp, i) => <p key={i} className="text-xs text-emerald-800">✓ {imp}</p>)}
              </div>
            )}
            {result.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Why It's Better</p>
                <p className="text-sm text-blue-900">{result.explanation as string}</p>
              </div>
            )}
            {result.performanceNote && (
              <p className="text-xs text-muted-foreground bg-gray-50 border border-border rounded-xl px-3.5 py-2.5">
                ⚡ {result.performanceNote as string}
              </p>
            )}
            {alternatives.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alternative Approaches</p>
                {alternatives.map((alt, i) => <code key={i} className="block text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{alt}</code>)}
              </div>
            )}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Convert Tool ──────────────────────────────────────────────────────────────
function ConvertTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<"to-vba" | "to-formula">("to-vba");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  async function run() {
    if (!input.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim(), direction, model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to convert."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const breakdown = Array.isArray(result?.breakdown) ? result.breakdown as { part: string; description: string }[] : [];

  return (
    <div className="space-y-3">
      {/* Direction toggle */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => { setDirection("to-vba"); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors ${direction === "to-vba" ? "bg-indigo-600 text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}
        >
          <Code2 className="w-3.5 h-3.5" /> Formula → VBA
        </button>
        <button
          onClick={() => { setDirection("to-formula"); setResult(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors ${direction === "to-formula" ? "bg-indigo-600 text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> VBA → Formula
        </button>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
          {direction === "to-vba" ? "Excel Formula" : "VBA Code"}
        </label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={direction === "to-vba" ? "=SUMIF(B:B,\"Paid\",A:A)" : "Sub LoopRows()\n  Dim i As Long\n  ...\nEnd Sub"}
          rows={4}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <button
        onClick={run}
        disabled={loading || !input.trim()}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting…</> : <><ArrowLeftRight className="w-4 h-4" /> Convert</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            {direction === "to-vba" && result.vbaCode && (
              <div className="bg-gray-900 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">VBA Code</p>
                  <button onClick={() => copy(result.vbaCode as string)} className="text-xs flex items-center gap-1 text-gray-400 hover:text-white">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto">{result.vbaCode as string}</pre>
              </div>
            )}
            {direction === "to-formula" && result.formula && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Excel Formula</p>
                  <button onClick={() => copy(result.formula as string)} className="text-xs flex items-center gap-1 text-indigo-700 hover:text-indigo-900">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <code className="block text-sm font-mono font-bold text-indigo-900 break-all">{result.formula as string}</code>
              </div>
            )}
            {result.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Explanation</p>
                <p className="text-sm text-blue-900">{result.explanation as string}</p>
              </div>
            )}
            {breakdown.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                {breakdown.map((item, i) => (
                  <div key={i} className={`flex gap-3 px-3.5 py-2.5 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"} border-b border-border last:border-0`}>
                    <code className="text-xs font-mono font-bold text-indigo-700 shrink-0 min-w-[70px]">{item.part}</code>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
            {result.usage && <p className="text-xs text-muted-foreground bg-gray-50 border border-border rounded-xl px-3.5 py-2.5">📋 {result.usage as string}</p>}
            {result.limitations && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">⚠ {result.limitations as string}</p>}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Explain Tool ──────────────────────────────────────────────────────────────
function ExplainTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [formula, setFormula] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (!formula.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula: formula.trim(), language, model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to explain formula."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const keyTerms = Array.isArray(result?.keyTerms) ? result.keyTerms as { term: string; meaning: string }[] : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Formula to Explain</label>
        <textarea
          value={formula}
          onChange={e => setFormula(e.target.value)}
          placeholder="Paste the formula you want explained"
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Output Language</label>
        <div className="relative">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors pr-8"
          >
            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>
      <button
        onClick={run}
        disabled={loading || !formula.trim()}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Explaining…</> : <><Globe className="w-4 h-4" /> Explain in {language}</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5">
              <p className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-1.5">Simple Explanation</p>
              <p className="text-sm text-teal-900 leading-relaxed">{result.simpleExplanation as string}</p>
            </div>
            {result.detailedExplanation && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Detailed Explanation</p>
                <p className="text-sm text-emerald-900 leading-relaxed">{result.detailedExplanation as string}</p>
              </div>
            )}
            {result.realWorldExample && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Real-World Example</p>
                <p className="text-sm text-amber-900 leading-relaxed">{result.realWorldExample as string}</p>
              </div>
            )}
            {keyTerms.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3.5 py-2 bg-gray-50 border-b border-border">Key Terms</p>
                {keyTerms.map((kt, i) => (
                  <div key={i} className={`flex gap-3 px-3.5 py-2.5 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} border-b border-border last:border-0`}>
                    <code className="text-xs font-mono font-bold text-indigo-700 shrink-0 min-w-[80px]">{kt.term}</code>
                    <p className="text-xs text-muted-foreground">{kt.meaning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Named Ranges Tool ─────────────────────────────────────────────────────────
function NamedRangesTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (description.trim().length < 10) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/named-ranges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate suggestions."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const recs = Array.isArray(result?.recommendations) ? result.recommendations as { name: string; suggestedRange: string; purpose: string; exampleUse: string }[] : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Describe Your Spreadsheet</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Column A has order dates, Column B has customer names, Column C has product names, Column D has quantities, Column E has prices, Column F has status (Paid/Pending)"
          rows={4}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <button
        onClick={run}
        disabled={loading || description.trim().length < 10}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Suggesting…</> : <><Tag className="w-4 h-4" /> Suggest Named Ranges</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            {recs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recommended Named Ranges</p>
                {recs.map((rec, i) => (
                  <div key={i} className="rounded-xl border border-violet-200 bg-violet-50 p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <code className="text-sm font-mono font-bold text-violet-800">{rec.name}</code>
                      <span className="text-[10px] text-violet-600 bg-white/60 border border-violet-200 rounded-full px-2 py-0.5">{rec.suggestedRange}</span>
                    </div>
                    <p className="text-xs text-violet-700 mb-2">{rec.purpose}</p>
                    <code className="block text-[11px] font-mono text-indigo-700 bg-white border border-violet-100 rounded-lg px-2.5 py-1.5">{rec.exampleUse}</code>
                  </div>
                ))}
              </div>
            )}
            {result.benefits && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Benefits</p>
                <p className="text-sm text-emerald-900">{result.benefits as string}</p>
              </div>
            )}
            {result.implementationSteps && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">How to Create in Excel</p>
                <p className="text-sm text-blue-900">{result.implementationSteps as string}</p>
              </div>
            )}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Analyze Tool ──────────────────────────────────────────────────────────────
function AnalyzeTool({ isLicensed, model, onUnlock }: { isLicensed: boolean; model: string; onUnlock: () => void }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (description.trim().length < 10) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to analyze workbook."); return; }
      setResult(data);
    } catch { setError("Network error — check your connection."); }
    finally { setLoading(false); }
  }

  const improvements = Array.isArray(result?.improvements) ? result.improvements as { area: string; recommendation: string; priority: string }[] : [];
  const recFormulas = Array.isArray(result?.recommendedFormulas) ? result.recommendedFormulas as { purpose: string; formula: string; where: string }[] : [];
  const structureTips = Array.isArray(result?.structureTips) ? result.structureTips as string[] : [];
  const automationOps = Array.isArray(result?.automationOpportunities) ? result.automationOpportunities as string[] : [];

  const priorityColor = (p: string) =>
    p === "High" ? "bg-red-100 text-red-700" : p === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Describe Your Workbook</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. I have a sales tracking workbook with 3 sheets: Orders (date, customer, product, qty, price, status), Inventory (product, stock level, reorder point), and Dashboard (summary charts). I want to track KPIs and automate reports."
          rows={5}
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
      <button
        onClick={run}
        disabled={loading || description.trim().length < 10}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><BarChart3 className="w-4 h-4" /> Analyze with AI</>}
      </button>
      {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
      {result && (
        <ResultBox isLicensed={isLicensed} onUnlock={onUnlock}>
          <div className="space-y-3">
            {result.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Summary</p>
                <p className="text-sm text-blue-900">{result.summary as string}</p>
              </div>
            )}
            {improvements.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recommendations</p>
                {improvements.map((imp, i) => (
                  <div key={i} className="rounded-xl border border-border bg-white p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-foreground">{imp.area}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityColor(imp.priority)}`}>{imp.priority}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{imp.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
            {recFormulas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recommended Formulas</p>
                {recFormulas.map((rf, i) => (
                  <div key={i} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">{rf.purpose}</p>
                    <code className="block text-xs font-mono text-indigo-900 bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 mb-1.5">{rf.formula}</code>
                    <p className="text-[10px] text-indigo-600">Where: {rf.where}</p>
                  </div>
                ))}
              </div>
            )}
            {structureTips.length > 0 && (
              <div className="bg-gray-50 border border-border rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Structure Tips</p>
                {structureTips.map((tip, i) => <p key={i} className="text-xs text-muted-foreground">• {tip}</p>)}
              </div>
            )}
            {automationOps.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Automation Opportunities</p>
                {automationOps.map((op, i) => <p key={i} className="text-xs text-amber-800">⚡ {op}</p>)}
              </div>
            )}
          </div>
        </ResultBox>
      )}
    </div>
  );
}

// ── Tools Tab Shell ───────────────────────────────────────────────────────────
interface ToolsTabProps {
  isLicensed: boolean;
  model: string;
  onUnlock: () => void;
}

export default function ToolsTab({ isLicensed, model, onUnlock }: ToolsTabProps) {
  const [activeTool, setActiveTool] = useState<ToolId>("debug");

  return (
    <div className="space-y-4 pb-4">
      {/* Tool nav */}
      <div className="grid grid-cols-3 gap-1.5">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
              activeTool === tool.id
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-muted-foreground border-border hover:border-indigo-200 hover:text-foreground"
            }`}
          >
            {tool.icon}
            <span className="text-[10px] font-bold leading-tight">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Tool description */}
      <div className="flex items-center gap-2 bg-gray-50 border border-border rounded-xl px-3.5 py-2.5">
        <span className="text-indigo-600">{TOOLS.find(t => t.id === activeTool)?.icon}</span>
        <div>
          <p className="text-xs font-bold text-foreground">{TOOLS.find(t => t.id === activeTool)?.label}</p>
          <p className="text-[10px] text-muted-foreground">{TOOLS.find(t => t.id === activeTool)?.desc}</p>
        </div>
        {!isLicensed && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <Lock className="w-2.5 h-2.5" /> Premium
          </span>
        )}
      </div>

      {/* Active tool */}
      {activeTool === "debug"        && <DebugTool       isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
      {activeTool === "optimize"     && <OptimizeTool    isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
      {activeTool === "convert"      && <ConvertTool     isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
      {activeTool === "explain"      && <ExplainTool     isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
      {activeTool === "named-ranges" && <NamedRangesTool isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
      {activeTool === "analyze"      && <AnalyzeTool     isLicensed={isLicensed} model={model} onUnlock={onUnlock} />}
    </div>
  );
}

export { MODELS };
