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

type SortCol = "deviation_id" | "step" | "parameter" | "timestamp" | "risk_level";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortCol, SortDir> = {
  deviation_id: "asc",
  step:         "asc",
  parameter:    "asc",
  timestamp:    "asc",
  risk_level:   "desc", // HIGH first
};

function SortIcon({ dir, active }: { dir: SortDir; active: boolean }) {
  return (
    <span className={`ml-1 inline-flex flex-col leading-none ${active ? "text-violet-600" : "text-slate-300"}`}>
      <span className={`text-[8px] ${active && dir === "asc"  ? "text-violet-600" : ""}`}>▲</span>
      <span className={`text-[8px] ${active && dir === "desc" ? "text-violet-600" : ""}`}>▼</span>
    </span>
  );
}

interface Props {
  deviations: Deviation[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function DeviationTable({ deviations, selected, onSelect }: Props) {
  const [active, setActive] = useState<Set<RiskLevel>>(new Set(["HIGH", "MEDIUM"]));
  const [sortCol, setSortCol] = useState<SortCol>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggle(level: RiskLevel) {
    setActive(prev => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  }

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(DEFAULT_DIR[col]);
    }
  }

  function compareRows(a: Deviation, b: Deviation): number {
    let cmp = 0;
    if (sortCol === "risk_level") {
      cmp = riskOrder[a.risk_level] - riskOrder[b.risk_level];
    } else {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      cmp = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return sortDir === "asc" ? cmp : -cmp;
  }

  const rows = [...deviations]
    .filter(d => active.has(d.risk_level))
    .sort(compareRows);

  const hiddenCount = deviations.length - rows.length;

  const cols: { key: SortCol; label: string }[] = [
    { key: "deviation_id", label: "ID" },
    { key: "step",         label: "Step" },
    { key: "parameter",    label: "Parameter" },
    { key: "timestamp",    label: "Timestamp" },
    { key: "risk_level",   label: "Risk" },
  ];

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
            {cols.map(({ key, label }) => (
              <th
                key={key}
                className="px-6 py-3 text-left cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
                onClick={() => handleSort(key)}
              >
                {label}
                <SortIcon dir={sortCol === key ? sortDir : DEFAULT_DIR[key]} active={sortCol === key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
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
