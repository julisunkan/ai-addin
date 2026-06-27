import { useState, useCallback, useRef } from "react";
import {
  Upload, BarChart2, LineChart, PieChart, ScatterChart,
  AreaChart, Loader2, AlertCircle, Sparkles, RefreshCw,
  FileSpreadsheet, ChevronDown, ChevronUp, Check, X,
  Table, TrendingUp, Layers
} from "lucide-react";
import {
  BarChart, Bar, LineChart as ReLineChart, Line, AreaChart as ReAreaChart, Area,
  PieChart as RePieChart, Pie, Cell,
  ScatterChart as ReScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#ec4899"];

type ChartType = "bar" | "line" | "area" | "pie" | "scatter";

interface Column { name: string; type: "numeric" | "text"; }
interface SheetData { columns: Column[]; rows: Record<string, unknown>[]; totalRows: number; }
interface WorkbookData { filename: string; sheets: string[]; sheetData: Record<string, SheetData>; }
interface AIInsights { bestChartType: ChartType; xColumn: string; yColumns: string[]; suggestedTitle: string; insights: string[]; reasoning: string; }

const CHART_TYPES: { id: ChartType; icon: React.ReactNode; label: string }[] = [
  { id: "bar",     icon: <BarChart2 className="w-4 h-4" />,     label: "Bar" },
  { id: "line",    icon: <LineChart className="w-4 h-4" />,     label: "Line" },
  { id: "area",    icon: <AreaChart className="w-4 h-4" />,     label: "Area" },
  { id: "pie",     icon: <PieChart className="w-4 h-4" />,      label: "Pie" },
  { id: "scatter", icon: <ScatterChart className="w-4 h-4" />,  label: "Scatter" },
];

function autoPickColumns(columns: Column[]): { xCol: string; yCols: string[] } {
  const textCols = columns.filter(c => c.type === "text");
  const numCols  = columns.filter(c => c.type === "numeric");
  const xCol  = textCols[0]?.name ?? columns[0]?.name ?? "";
  const yCols = numCols.slice(0, 3).map(c => c.name);
  if (yCols.length === 0 && columns.length > 1) yCols.push(columns[1].name);
  return { xCol, yCols };
}

// ── Chart Renderer ────────────────────────────────────────────────────────────
function ChartRenderer({ type, data, xColumn, yColumns, title }: {
  type: ChartType;
  data: Record<string, unknown>[];
  xColumn: string;
  yColumns: string[];
  title: string;
}) {
  const chartData = data.slice(0, 200);

  if (chartData.length === 0 || !xColumn || yColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <BarChart2 className="w-8 h-8 opacity-30" />
        <p className="text-xs">Select X and Y columns to render a chart</p>
      </div>
    );
  }

  const commonProps = {
    margin: { top: 8, right: 8, left: 0, bottom: 40 },
  };

  const xAxisProps = {
    dataKey: xColumn,
    tick: { fontSize: 10 },
    angle: -35,
    textAnchor: "end" as const,
    interval: Math.max(0, Math.floor(chartData.length / 10) - 1),
  };

  const yAxisProps = { tick: { fontSize: 10 }, width: 48 };

  const tooltipStyle = { fontSize: 11, borderRadius: 8 };

  if (type === "pie") {
    const yCol = yColumns[0];
    const pieData = chartData
      .map(r => ({ name: String(r[xColumn] ?? ""), value: Number(r[yCol] ?? 0) }))
      .filter(d => d.value > 0)
      .slice(0, 10);

    return (
      <div>
        {title && <p className="text-xs font-bold text-center text-muted-foreground mb-2">{title}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <RePieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
              {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
          </RePieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "scatter") {
    const yCol = yColumns[0];
    const scatterData = chartData.map(r => ({ x: Number(r[xColumn] ?? 0), y: Number(r[yCol] ?? 0) }));
    return (
      <div>
        {title && <p className="text-xs font-bold text-center text-muted-foreground mb-2">{title}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <ReScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" dataKey="x" name={xColumn} tick={{ fontSize: 10 }} label={{ value: xColumn, position: "insideBottom", offset: -30, fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name={yCol} {...yAxisProps} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} />
            <Scatter data={scatterData} fill={CHART_COLORS[0]} opacity={0.7} />
          </ReScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "line") {
    return (
      <div>
        {title && <p className="text-xs font-bold text-center text-muted-foreground mb-2">{title}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <ReLineChart data={chartData} {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {yColumns.map((col, i) => (
              <Line key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={chartData.length < 30} />
            ))}
          </ReLineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "area") {
    return (
      <div>
        {title && <p className="text-xs font-bold text-center text-muted-foreground mb-2">{title}</p>}
        <ResponsiveContainer width="100%" height={260}>
          <ReAreaChart data={chartData} {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {yColumns.map((col, i) => (
              <Area key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </ReAreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: bar
  return (
    <div>
      {title && <p className="text-xs font-bold text-center text-muted-foreground mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {yColumns.map((col, i) => (
            <Bar key={col} dataKey={col} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ onFile, uploading, error }: {
  onFile: (f: File) => void;
  uploading: boolean;
  error: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-12 px-6 cursor-pointer transition-all ${
          dragOver ? "border-indigo-400 bg-indigo-50" : uploading ? "border-border bg-gray-50 cursor-wait" : "border-border hover:border-indigo-300 hover:bg-indigo-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">Parsing your file…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
              <Upload className="w-7 h-7 text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Drop your file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>
            <div className="flex items-center gap-2">
              {[".xlsx", ".xls", ".csv"].map(ext => (
                <span key={ext} className="text-[10px] font-bold bg-white border border-border rounded-full px-2.5 py-1 text-muted-foreground">{ext}</span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Max 10 MB · Up to 500 rows rendered</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Sample hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
        <p className="text-xs font-bold text-blue-700">Tips for best results</p>
        <p className="text-[11px] text-blue-800">• First row should be column headers</p>
        <p className="text-[11px] text-blue-800">• Numeric columns (sales, amounts, counts) make great Y axes</p>
        <p className="text-[11px] text-blue-800">• Text columns (dates, names, categories) work best as X axis</p>
      </div>
    </div>
  );
}

// ── Main VisualizeTab ─────────────────────────────────────────────────────────
export default function VisualizeTab() {
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState("");
  const [workbook, setWorkbook]           = useState<WorkbookData | null>(null);
  const [activeSheet, setActiveSheet]     = useState("");
  const [chartType, setChartType]         = useState<ChartType>("bar");
  const [xColumn, setXColumn]             = useState("");
  const [yColumns, setYColumns]           = useState<string[]>([]);
  const [chartTitle, setChartTitle]       = useState("");
  const [showPreview, setShowPreview]     = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights]           = useState<AIInsights | null>(null);
  const [insightsError, setInsightsError] = useState("");
  const [showInsights, setShowInsights]   = useState(false);

  const sheetData: SheetData | null = workbook ? workbook.sheetData[activeSheet] : null;
  const columns = sheetData?.columns ?? [];
  const rows    = sheetData?.rows ?? [];
  const numericCols = columns.filter(c => c.type === "numeric");

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    setInsights(null);
    setInsightsError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/visualize/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || "Upload failed."); return; }

      setWorkbook(data);
      const sheet = data.sheets[0];
      setActiveSheet(sheet);
      initChartFromSheet(data.sheetData[sheet]);
    } catch {
      setUploadError("Network error — check your connection.");
    } finally {
      setUploading(false);
    }
  }

  function initChartFromSheet(sd: SheetData) {
    const { xCol, yCols } = autoPickColumns(sd.columns);
    setXColumn(xCol);
    setYColumns(yCols);
    setChartTitle("");
    setChartType("bar");
    setShowPreview(false);
    setInsights(null);
  }

  function handleSheetChange(name: string) {
    setActiveSheet(name);
    if (workbook) initChartFromSheet(workbook.sheetData[name]);
  }

  function toggleYColumn(col: string) {
    setYColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }

  async function handleGetInsights() {
    if (!sheetData) return;
    setLoadingInsights(true);
    setInsightsError("");
    setInsights(null);

    try {
      const res = await fetch(`${API_BASE}/api/visualize/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: sheetData.columns,
          sampleRows: sheetData.rows.slice(0, 10),
          totalRows: sheetData.totalRows,
          sheetName: activeSheet,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setInsightsError(data.error || "Failed to get insights."); return; }

      setInsights(data);
      setShowInsights(true);

      // Auto-apply AI suggestions
      if (data.bestChartType) setChartType(data.bestChartType);
      if (data.xColumn && columns.some(c => c.name === data.xColumn)) setXColumn(data.xColumn);
      if (Array.isArray(data.yColumns)) {
        const valid = data.yColumns.filter((c: string) => columns.some(col => col.name === c));
        if (valid.length > 0) setYColumns(valid);
      }
      if (data.suggestedTitle) setChartTitle(data.suggestedTitle);
    } catch {
      setInsightsError("Network error — check your connection.");
    } finally {
      setLoadingInsights(false);
    }
  }

  function resetFile() {
    setWorkbook(null);
    setActiveSheet("");
    setXColumn("");
    setYColumns([]);
    setChartTitle("");
    setInsights(null);
    setInsightsError("");
    setUploadError("");
    setShowPreview(false);
    setShowInsights(false);
  }

  // ── No file yet ─────────────────────────────────────────────────────────────
  if (!workbook) {
    return (
      <div className="space-y-4 pb-4">
        <p className="text-xs text-muted-foreground">Upload an Excel or CSV file to create beautiful charts instantly.</p>
        <UploadZone onFile={handleFile} uploading={uploading} error={uploadError} />
      </div>
    );
  }

  // ── File loaded ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6">

      {/* File info bar */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-800 truncate">{workbook.filename}</p>
          <p className="text-[10px] text-emerald-600">
            {(sheetData?.totalRows ?? 0).toLocaleString()} rows · {columns.length} columns
            {workbook.sheets.length > 1 && ` · ${workbook.sheets.length} sheets`}
          </p>
        </div>
        <button
          onClick={resetFile}
          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-red-600 bg-white border border-emerald-200 rounded-lg px-2 py-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Change
        </button>
      </div>

      {/* Sheet selector */}
      {workbook.sheets.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {workbook.sheets.map(s => (
            <button
              key={s}
              onClick={() => handleSheetChange(s)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                activeSheet === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-muted-foreground border-border hover:border-indigo-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chart type selector */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chart Type</p>
        <div className="grid grid-cols-5 gap-1.5">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setChartType(ct.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition-all ${
                chartType === ct.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-muted-foreground border-border hover:border-indigo-200"
              }`}
            >
              {ct.icon}
              <span className="text-[10px] font-bold">{ct.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* X Axis */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          {chartType === "scatter" ? "X Axis (Numeric)" : "X Axis / Labels"}
        </p>
        <div className="relative">
          <select
            value={xColumn}
            onChange={e => setXColumn(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors pr-8"
          >
            <option value="">— Select column —</option>
            {(chartType === "scatter" ? numericCols : columns).map(c => (
              <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Y Axis (columns) */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          {chartType === "pie" || chartType === "scatter" ? "Y Axis / Value (pick one)" : "Y Axis / Values (pick one or more)"}
        </p>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {(chartType === "scatter" ? numericCols : numericCols.length > 0 ? numericCols : columns).map(col => {
            const isSelected = yColumns.includes(col.name);
            const disabled = (chartType === "pie" || chartType === "scatter") && yColumns.length >= 1 && !isSelected;
            return (
              <button
                key={col.name}
                onClick={() => !disabled && toggleYColumn(col.name)}
                disabled={disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors text-xs font-semibold ${
                  isSelected ? "bg-indigo-50 border-indigo-300 text-indigo-700" : disabled ? "opacity-40 cursor-not-allowed bg-gray-50 border-border text-muted-foreground" : "bg-white border-border text-muted-foreground hover:border-indigo-200 hover:text-foreground"
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="flex-1 truncate">{col.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-muted-foreground"}`}>
                  {col.type}
                </span>
              </button>
            );
          })}
          {numericCols.length === 0 && columns.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No columns available</p>
          )}
        </div>
      </div>

      {/* Chart title (optional) */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Chart Title (optional)</label>
        <input
          value={chartTitle}
          onChange={e => setChartTitle(e.target.value)}
          placeholder="e.g. Monthly Sales by Region"
          className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Chart display */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
        <ChartRenderer
          type={chartType}
          data={rows}
          xColumn={xColumn}
          yColumns={yColumns}
          title={chartTitle}
        />
      </div>

      {/* AI Insights button */}
      <div className="space-y-2">
        <button
          onClick={handleGetInsights}
          disabled={loadingInsights}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl py-3 text-sm font-bold hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loadingInsights
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your data…</>
            : <><Sparkles className="w-4 h-4" /> Get AI Insights & Auto-configure</>}
        </button>
        <p className="text-[10px] text-center text-muted-foreground">AI will analyze your data and automatically choose the best chart type, axes, and title.</p>
      </div>

      {insightsError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {insightsError}
        </div>
      )}

      {/* AI Insights panel */}
      {insights && (
        <div className="rounded-2xl border border-violet-200 overflow-hidden">
          <button
            onClick={() => setShowInsights(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-700">AI Insights Applied</span>
              <span className="text-[10px] bg-violet-200 text-violet-700 font-bold rounded-full px-2 py-0.5">{insights.insights?.length ?? 0} findings</span>
            </div>
            {showInsights ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />}
          </button>
          {showInsights && (
            <div className="px-4 py-3.5 space-y-3 bg-white">
              {insights.reasoning && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-violet-700 mb-1">Why this chart?</p>
                  <p className="text-xs text-violet-900">{insights.reasoning}</p>
                </div>
              )}
              {insights.insights?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Findings</p>
                  {insights.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-gray-50 border border-border rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Chart</p>
                  <p className="text-xs font-bold text-foreground capitalize">{insights.bestChartType}</p>
                </div>
                <div className="bg-gray-50 border border-border rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">X Axis</p>
                  <p className="text-xs font-bold text-foreground truncate">{insights.xColumn}</p>
                </div>
                <div className="bg-gray-50 border border-border rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Y Axes</p>
                  <p className="text-xs font-bold text-foreground truncate">{insights.yColumns?.join(", ")}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowPreview(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Table className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data Preview</span>
            <span className="text-[10px] bg-gray-200 text-muted-foreground font-bold rounded-full px-2 py-0.5">
              {Math.min(rows.length, 10)} of {(sheetData?.totalRows ?? 0).toLocaleString()} rows
            </span>
          </div>
          {showPreview ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>

        {showPreview && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  {columns.slice(0, 6).map(col => (
                    <th key={col.name} className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">
                      {col.name}
                      <span className={`ml-1 text-[9px] px-1 rounded ${col.type === "numeric" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                        {col.type === "numeric" ? "#" : "T"}
                      </span>
                    </th>
                  ))}
                  {columns.length > 6 && <th className="px-3 py-2 text-muted-foreground">+{columns.length - 6} more</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    {columns.slice(0, 6).map(col => (
                      <td key={col.name} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[100px] truncate">
                        {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                    {columns.length > 6 && <td className="px-3 py-2 text-muted-foreground">…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
