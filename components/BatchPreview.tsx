"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, ResponsiveContainer, ReferenceLine,
  Tooltip, XAxis, YAxis, Scatter, ComposedChart, Area,
} from "recharts";

interface Row {
  timestamp: string;
  step: string;
  temperature_c: number | null;
  pressure_bar: number | null;
  ph: number | null;
  mixing_rpm: number | null;
  anomalous?: boolean;
}

// Known anomalous timestamps from EXPECTED.md
function generatePhDriftTs(): string[] {
  // Drift runs continuously from 09:25 to 10:14 (50 readings)
  const result: string[] = [];
  let h = 9, m = 25;
  for (let k = 0; k < 50; k++) {
    result.push(`2024-03-12 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    m += 1;
    if (m >= 60) { m = 0; h += 1; }
  }
  return result;
}

const ANOMALOUS_TS = new Set([
  "2024-03-12 07:05:00", // multivariate MIXING
  "2024-03-12 07:06:00",
  "2024-03-12 07:40:00", // RPM context HEATING
  "2024-03-12 07:50:00", // temp spike
  "2024-03-12 07:51:00",
  ...generatePhDriftTs(), // pH drift FILLING 09:25–10:14 (continuous, no recovery)
]);

// Step color palette
const STEP_COLOR: Record<string, string> = {
  WEIGHING: "#94a3b8",
  MIXING:   "#818cf8",
  HEATING:  "#f97316",
  COOLING:  "#38bdf8",
  FILLING:  "#34d399",
  CAPPING:  "#94a3b8",
};

// Acceptable ranges per parameter (for reference lines)
const LIMITS: Record<string, { lo: number; hi: number; label: string; unit: string }> = {
  temperature_c: { lo: 68, hi: 77,  label: "Temperature", unit: "°C" },
  ph:            { lo: 6.7, hi: 7.3, label: "pH",         unit: "" },
  mixing_rpm:    { lo: 0,  hi: 210,  label: "RPM",        unit: "" },
};

function parseCSV(text: string): Row[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const get = (k: string) => vals[headers.indexOf(k)] ?? "";
    const num = (k: string) => { const v = parseFloat(get(k)); return isNaN(v) ? null : v; };
    const ts = get("timestamp");
    return {
      timestamp: ts,
      step: get("step"),
      temperature_c: num("temperature_c"),
      pressure_bar: num("pressure_bar"),
      ph: num("ph"),
      mixing_rpm: num("mixing_rpm"),
      anomalous: ANOMALOUS_TS.has(ts),
    };
  });
}

// ── Sparkline with anomaly dots ──────────────────────────────────────────────
function Sparkline({
  data, field, limits, height = 120,
}: {
  data: Row[];
  field: keyof Pick<Row, "temperature_c" | "ph" | "mixing_rpm">;
  limits: typeof LIMITS[string];
  height?: number;
}) {
  const points = data
    .filter(r => r[field] !== null)
    .map((r, i) => ({
      i,
      value: r[field] as number,
      anomalous: r.anomalous,
      step: r.step,
      timestamp: r.timestamp,
    }));

  const anomalies = points.filter(p => p.anomalous);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1">
        {limits.label}
        <span className="font-normal text-slate-400 ml-1">
          acceptable {limits.lo}–{limits.hi}{limits.unit}
        </span>
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="i" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-slate-700">{d.step} · {d.timestamp.slice(11, 16)}</p>
                  <p className={d.anomalous ? "text-red-600 font-bold" : "text-slate-600"}>
                    {d.value}{limits.unit} {d.anomalous ? "⚠ anomaly" : ""}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine y={limits.hi} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={limits.lo} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366B4"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
          />
          <Scatter
            data={anomalies}
            dataKey="value"
            fill="#ef4444"
            shape={(props: { cx?: number; cy?: number }) => (
              <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Sampled table ────────────────────────────────────────────────────────────
const TABLE_COLS = ["timestamp", "step", "temperature_c", "pressure_bar", "ph", "mixing_rpm"] as const;
const COL_LABELS: Record<string, string> = {
  timestamp: "Timestamp", step: "Step",
  temperature_c: "Temp (°C)", pressure_bar: "Pressure (bar)",
  ph: "pH", mixing_rpm: "RPM",
};

function SampledTable({ rows }: { rows: Row[] }) {
  // 2 normal rows per step (excluding anomalous), capped at 10 total
  const normalRows: Row[] = [];
  const seenSteps: Record<string, number> = {};
  for (const r of rows) {
    if (!r.anomalous) {
      seenSteps[r.step] = (seenSteps[r.step] ?? 0) + 1;
      if (seenSteps[r.step] <= 2) normalRows.push(r);
    }
    if (normalRows.length >= 10) break;
  }

  const anomalousRows = rows.filter(r => r.anomalous);
  // Show only one row per "event" (first of each contiguous group)
  const shownAnomalies: Row[] = [];
  let lastAnomStep = "";
  for (const r of anomalousRows) {
    const key = r.step + (r.timestamp.slice(0, 15));
    if (key !== lastAnomStep) { shownAnomalies.push(r); lastAnomStep = key; }
    if (shownAnomalies.length >= 6) break;
  }

  const fmt = (v: number | null | string) =>
    v === null ? <span className="text-slate-300">—</span> : String(v);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
            {TABLE_COLS.map(c => (
              <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{COL_LABELS[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {normalRows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-mono text-slate-400">{r.timestamp.slice(11, 16)}</td>
              <td className="px-3 py-1.5">
                <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium" style={{ background: STEP_COLOR[r.step] ?? "#94a3b8" }}>{r.step}</span>
              </td>
              <td className="px-3 py-1.5 text-slate-600">{fmt(r.temperature_c)}</td>
              <td className="px-3 py-1.5 text-slate-600">{fmt(r.pressure_bar)}</td>
              <td className="px-3 py-1.5 text-slate-600">{fmt(r.ph)}</td>
              <td className="px-3 py-1.5 text-slate-600">{fmt(r.mixing_rpm)}</td>
            </tr>
          ))}
          {/* Separator */}
          <tr className="bg-red-50 border-t-2 border-red-200">
            <td colSpan={6} className="px-3 py-1 text-[10px] font-semibold text-red-500 uppercase tracking-wide">
              ⚠ Injected deviations — visible in raw data
            </td>
          </tr>
          {shownAnomalies.map((r, i) => (
            <tr key={i} className="border-t border-red-100 bg-red-50">
              <td className="px-3 py-1.5 font-mono text-red-400">{r.timestamp.slice(11, 16)}</td>
              <td className="px-3 py-1.5">
                <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium" style={{ background: STEP_COLOR[r.step] ?? "#94a3b8" }}>{r.step}</span>
              </td>
              <td className={`px-3 py-1.5 font-medium ${r.temperature_c !== null && (r.temperature_c > 77 || r.temperature_c < 68) ? "text-red-600" : "text-slate-600"}`}>{fmt(r.temperature_c)}</td>
              <td className="px-3 py-1.5 text-slate-600">{fmt(r.pressure_bar)}</td>
              <td className={`px-3 py-1.5 font-medium ${r.ph !== null && (r.ph > 7.3 || r.ph < 6.7) ? "text-red-600" : "text-slate-600"}`}>{fmt(r.ph)}</td>
              <td className={`px-3 py-1.5 font-medium ${r.mixing_rpm !== null && r.step === "HEATING" ? "text-orange-600" : "text-slate-600"}`}>{fmt(r.mixing_rpm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function BatchPreview({ csvPath }: { csvPath: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(csvPath)
      .then(r => r.text())
      .then(text => setRows(parseCSV(text)));
  }, [csvPath]);

  if (!rows) return <p className="text-xs text-slate-400 py-4 text-center">Loading preview…</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Sparklines */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Process parameters over time
          <span className="ml-2 font-normal normal-case text-slate-400">— red dots = injected anomalies · dashed lines = acceptable limits</span>
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Sparkline data={rows} field="temperature_c" limits={LIMITS.temperature_c} />
          <Sparkline data={rows} field="ph"            limits={LIMITS.ph} />
          <Sparkline data={rows} field="mixing_rpm"    limits={LIMITS.mixing_rpm} />
        </div>
      </div>

      {/* Sampled table */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Raw data sample
          <span className="ml-2 font-normal normal-case text-slate-400">— 10 normal readings + anomalous rows</span>
        </p>
        <SampledTable rows={rows} />
      </div>
    </div>
  );
}
