"use client";
import { useState } from "react";
import { Deviation, RiskLevel } from "@/lib/types";

const riskOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const riskBadge: Record<RiskLevel, string> = {
  HIGH:   "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW:    "bg-green-100 text-green-700",
};

const filterBtn = {
  active: {
    HIGH:   "bg-red-100 text-red-700 border-red-300",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-300",
    LOW:    "bg-green-100 text-green-700 border-green-300",
  },
  inactive: "bg-white text-slate-400 border-slate-200",
};

interface Props {
  deviations: Deviation[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function DeviationTable({ deviations, selected, onSelect }: Props) {
  const [active, setActive] = useState<Set<RiskLevel>>(new Set(["HIGH", "MEDIUM"]));

  function toggle(level: RiskLevel) {
    setActive(prev => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  const sorted = [...deviations]
    .sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level])
    .filter(d => active.has(d.risk_level));

  const hiddenCount = deviations.length - sorted.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-800">Detected Deviations</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Show:</span>
          {(["HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map(level => (
            <button
              key={level}
              onClick={() => toggle(level)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active.has(level) ? filterBtn.active[level] : filterBtn.inactive}`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <th className="px-6 py-3 text-left">ID</th>
            <th className="px-6 py-3 text-left">Step</th>
            <th className="px-6 py-3 text-left">Parameter</th>
            <th className="px-6 py-3 text-left">Timestamp</th>
            <th className="px-6 py-3 text-left">Risk</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr
              key={d.deviation_id}
              onClick={() => onSelect(d.deviation_id)}
              className={`border-t border-slate-100 cursor-pointer transition-colors ${selected === d.deviation_id ? "bg-violet-50" : "hover:bg-slate-50"}`}
            >
              <td className="px-6 py-4 font-mono font-medium text-slate-700">{d.deviation_id}</td>
              <td className="px-6 py-4 text-slate-600">{d.step}</td>
              <td className="px-6 py-4 text-slate-600 max-w-48 truncate">{d.parameter}</td>
              <td className="px-6 py-4 text-slate-500 font-mono text-xs">{d.timestamp}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadge[d.risk_level]}`}>
                  {d.risk_level}
                </span>
              </td>
            </tr>
          ))}
          {hiddenCount > 0 && (
            <tr className="border-t border-slate-100">
              <td colSpan={5} className="px-6 py-3 text-xs text-slate-400 text-center">
                {hiddenCount} deviation{hiddenCount > 1 ? "s" : ""} hidden by active filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
