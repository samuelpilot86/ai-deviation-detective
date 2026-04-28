"use client";
import { useEffect, useState } from "react";
import {
  Line, ResponsiveContainer, ReferenceLine,
  Tooltip, XAxis, YAxis, ComposedChart,
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
  // Drift runs continuously from 09:26 to 10:14 (49 readings, pH > 7.2)
  const result: string[] = [];
  let h = 9, m = 26;
  for (let k = 0; k < 49; k++) {
    result.push(`2024-03-12 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    m += 1;
    if (m >= 60) { m = 0; h += 1; }
  }
  return result;
}

// Per-parameter anomalous timestamps — a row may be anomalous for one param but normal for others
const ANOMALOUS_BY_FIELD: Record<"temperature_c" | "ph" | "mixing_rpm", Set<string>> = {
  temperature_c: new Set([
    "2024-03-12 07:50:00", // temp spike 89.4°C
    "2024-03-12 07:51:00", // temp spike 87.1°C
  ]),
  ph: new Set(generatePhDriftTs()), // pH drift FILLING 09:26–10:14
  mixing_rpm: new Set([
    "2024-03-12 07:40:00", // RPM=178 during HEATING (out-of-context)
  ]),
};

// Union of all anomalous timestamps (used for table highlighting)
const ANOMALOUS_TS = new Set<string>([
  "2024-03-12 07:05:00", // multivariate MIXING (temp+pressure combo)
  "2024-03-12 07:06:00",
  ...ANOMALOUS_BY_FIELD.temperature_c,
  ...ANOMALOUS_BY_FIELD.ph,
  ...ANOMALOUS_BY_FIELD.mixing_rpm,
]);

// Step color palette
const STEP_COLOR: Record<string, string> = {
  WEIGHING: "#d4b896",
  MIXING:   "#818cf8",
  HEATING:  "#f97316",
  COOLING:  "#38bdf8",
  FILLING:  "#34d399",
  CAPPING:  "#64748b",
};

// Acceptable ranges per parameter (for reference lines)
const LIMITS: Record<string, { lo: number; hi: number; label: string; unit: string; yTicks: number[] }> = {
  temperature_c: { lo: 68, hi: 77,  label: "Temperature",   unit: "°C",  yTicks: [15, 30, 45, 60, 75, 90] },
  ph:            { lo: 6.7, hi: 7.3, label: "Acidity",      unit: " pH", yTicks: [6.5, 7.0, 7.5, 8.0] },
  mixing_rpm:    { lo: 0,  hi: 210,  label: "Agitator speed", unit: " RPM", yTicks: [0, 50, 100, 150, 200] },
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
  data, field, limits, height = 160,
}: {
  data: Row[];
  field: keyof Pick<Row, "temperature_c" | "ph" | "mixing_rpm">;
  limits: typeof LIMITS[string];
  height?: number;
}) {
  const fieldAnomalies = ANOMALOUS_BY_FIELD[field];
  // Use ALL rows (full timeline), value is null when parameter not measured in that step
  const points = data.map((r, i) => ({
    i,
    value: r[field] as number | null,
    anomalous: fieldAnomalies.has(r.timestamp),
    step: r.step,
    timestamp: r.timestamp,
  }));

  // X-axis ticks: one per whole hour (e.g. 06:00, 07:00, …)
  const xTicks = (() => {
    const seen = new Set<string>();
    return points
      .filter(p => {
        const hhmm = p.timestamp.slice(11, 16);
        if (hhmm.endsWith(":00") && !seen.has(hhmm)) { seen.add(hhmm); return true; }
        return false;
      })
      .map(p => p.i);
  })();

  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1">
        {limits.label}
        <span className="font-normal text-slate-400 ml-1">
          acceptable {limits.lo}–{limits.hi}{limits.unit}
        </span>
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, left: 32, bottom: 20 }}>
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, points.length - 1]}
            ticks={xTicks}
            tickFormatter={(v: number) => {
              const p = points[v];
              return p ? p.timestamp.slice(11, 16) : "";
            }}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            domain={[limits.yTicks[0], limits.yTicks[limits.yTicks.length - 1]]}
            ticks={limits.yTicks}
            tickFormatter={(v: number) => `${v}${limits.unit}`}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-slate-700">{d.step} · {d.timestamp.slice(11, 16)}</p>
                  <p className={d.anomalous ? "text-red-600 font-bold" : "text-slate-600"}>
                    {d.value}{limits.unit} {d.anomalous ? "⚠ deviation" : ""}
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
            connectNulls={false}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: { anomalous?: boolean; value?: number | null }; index?: number }) => {
              if (props.payload?.value == null || !props.payload?.anomalous) {
                return <circle key={`d-${props.index}`} cx={props.cx} cy={props.cy} r={0} fill="none" />;
              }
              return (
                <circle
                  key={`a-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={false}
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
  ph: "Acidity (pH)", mixing_rpm: "Agitator speed (RPM)",
};

function SampledTable({ rows }: { rows: Row[] }) {
  // 2 rows per step, capped at 12 total
  const sampledRows: Row[] = [];
  const seenSteps: Record<string, number> = {};
  for (const r of rows) {
    seenSteps[r.step] = (seenSteps[r.step] ?? 0) + 1;
    if (seenSteps[r.step] <= 2) sampledRows.push(r);
    if (sampledRows.length >= 12) break;
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
          {sampledRows.map((r, i) => (
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
          <span className="ml-2 font-normal normal-case text-slate-400">— red dots = flagged anomalies · dashed lines = acceptable limits</span>
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
          <span className="ml-2 font-normal normal-case text-slate-400">— sample of process readings across all steps</span>
        </p>
        <SampledTable rows={rows} />
      </div>
    </div>
  );
}
