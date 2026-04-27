import { AnalysisResult, RiskLevel } from "@/lib/types";

const riskColors: Record<RiskLevel, string> = {
  HIGH:   "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW:    "bg-green-100 text-green-700 border-green-200",
};

export default function MetricsBar({ result }: { result: AnalysisResult }) {
  const high   = result.deviations.filter(d => d.risk_level === "HIGH").length;
  const medium = result.deviations.filter(d => d.risk_level === "MEDIUM").length;
  const low    = result.deviations.filter(d => d.risk_level === "LOW").length;
  const maxRisk: RiskLevel = high > 0 ? "HIGH" : medium > 0 ? "MEDIUM" : "LOW";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap gap-4 items-center">
      <div className="flex-1 min-w-32">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Batch</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{result.batch_id}</p>
      </div>
      <div className="flex-1 min-w-32">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Readings</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{result.total_rows}</p>
      </div>
      <div className="flex-1 min-w-32">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Deviations</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{result.deviation_count}</p>
      </div>
      <div className="flex-1 min-w-32">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Batch Status</p>
        <span className={`inline-block mt-0.5 px-3 py-1 rounded-full text-sm font-semibold border ${riskColors[maxRisk]}`}>
          {maxRisk === "HIGH" ? "⛔ Hold" : maxRisk === "MEDIUM" ? "⚠️ Review" : "✅ Clear"}
        </span>
      </div>
      <div className="flex gap-3">
        {high   > 0 && <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 border border-red-200">{high} HIGH</span>}
        {medium > 0 && <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700 border border-amber-200">{medium} MEDIUM</span>}
        {low    > 0 && <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-200">{low} LOW</span>}
      </div>
    </div>
  );
}
