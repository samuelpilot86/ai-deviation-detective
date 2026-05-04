"use client";
import { useEffect, useState } from "react";
import {
  Line, ResponsiveContainer, ReferenceLine,
  Tooltip, XAxis, YAxis, ComposedChart, Legend,
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

// Rule-based anomalous timestamps (limit breach, context error, data gap)
const RULE_BASED_BY_FIELD: Record<"temperature_c" | "pressure_bar" | "ph" | "mixing_rpm", Set<string>> = {
  temperature_c: new Set([
    "2024-03-12 07:50:00", // temp spike 89.4°C
    "2024-03-12 07:51:00", // temp spike 87.1°C
  ]),
  pressure_bar: new Set<string>(),
  ph: new Set(generatePhDriftTs()), // pH drift FILLING 09:26–10:14
  mixing_rpm: new Set([
    "2024-03-12 07:40:00", // RPM=178 during HEATING (out-of-context rule)
  ]),
};

// IF-only anomalous timestamps (no rule fires — only Isolation Forest catches these)
const IF_ONLY_BY_FIELD: Record<"temperature_c" | "pressure_bar" | "ph" | "mixing_rpm", Set<string>> = {
  temperature_c: new Set<string>(),
  pressure_bar:  new Set<string>(),
  ph:            new Set<string>(),
  mixing_rpm: new Set([
    "2024-03-12 06:45:00", // RPM=195 during MIXING — within limits but 6.8σ from step norm
  ]),
};

// Keep ANOMALOUS_BY_FIELD as union for backward compat (table highlighting)
const ANOMALOUS_BY_FIELD: Record<"temperature_c" | "pressure_bar" | "ph" | "mixing_rpm", Set<string>> = {
  temperature_c: new Set([...RULE_BASED_BY_FIELD.temperature_c, ...IF_ONLY_BY_FIELD.temperature_c]),
  pressure_bar:  new Set([...RULE_BASED_BY_FIELD.pressure_bar,  ...IF_ONLY_BY_FIELD.pressure_bar]),
  ph:            new Set([...RULE_BASED_BY_FIELD.ph,            ...IF_ONLY_BY_FIELD.ph]),
  mixing_rpm:    new Set([...RULE_BASED_BY_FIELD.mixing_rpm,    ...IF_ONLY_BY_FIELD.mixing_rpm]),
};

// Union of all anomalous timestamps (used for table highlighting)
const ANOMALOUS_TS = new Set<string>([
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
  temperature_c: { lo: 68, hi: 77,  label: "Temperature",    unit: "°C",  yTicks: [15, 30, 45, 60, 75, 90] },
  pressure_bar:  { lo: 1.0, hi: 4.0, label: "Pressure",      unit: " bar", yTicks: [1.0, 2.0, 3.0, 4.0, 5.0] },
  ph:            { lo: 6.7, hi: 7.3, label: "Acidity",       unit: " pH", yTicks: [6.5, 7.0, 7.5, 8.0] },
  mixing_rpm:    { lo: 0,  hi: 210,  label: "Agitator speed", unit: " RPM", yTicks: [0, 50, 100, 150, 200] },
};

function parseCSV(text: string): Row[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  const raw: Row[] = lines.slice(1).map(line => {
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
  return fillTimeGaps(raw);
}

// Insert null-valued rows for missing minutes so charts show real time-axis gaps.
function fillTimeGaps(rows: Row[]): Row[] {
  if (rows.length === 0) return rows;
  const out: Row[] = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const prevT = Date.parse(prev.timestamp.replace(" ", "T"));
    const currT = Date.parse(curr.timestamp.replace(" ", "T"));
    const gapMin = Math.round((currT - prevT) / 60000);
    if (gapMin > 1) {
      for (let m = 1; m < gapMin; m++) {
        const t = new Date(prevT + m * 60000);
        const pad = (n: number) => String(n).padStart(2, "0");
        const ts =
          `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ` +
          `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
        out.push({
          timestamp: ts,
          step: prev.step,
          temperature_c: null,
          pressure_bar: null,
          ph: null,
          mixing_rpm: null,
        });
      }
    }
    out.push(curr);
  }
  return out;
}

// ── Sparkline with anomaly dots ──────────────────────────────────────────────
function Sparkline({
  data, field, limits, height = 160,
}: {
  data: Row[];
  field: keyof Pick<Row, "temperature_c" | "pressure_bar" | "ph" | "mixing_rpm">;
  limits: typeof LIMITS[string];
  height?: number;
}) {
  const ruleAnomalies = RULE_BASED_BY_FIELD[field as keyof typeof RULE_BASED_BY_FIELD];
  const ifOnlyAnomalies = IF_ONLY_BY_FIELD[field as keyof typeof IF_ONLY_BY_FIELD];
  // Use ALL rows (full timeline), value is null when parameter not measured in that step
  const points = data.map((r, i) => ({
    i,
    value: r[field] as number | null,
    ruleAnomaly: ruleAnomalies.has(r.timestamp),
    ifOnlyAnomaly: ifOnlyAnomalies.has(r.timestamp),
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
        <ComposedChart data={points} margin={{ top: 4, right: 66, left: 8, bottom: 20 }}>
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
            width={60}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const isAnomaly = d.ruleAnomaly || d.ifOnlyAnomaly;
              return (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-slate-700">{d.step} · {d.timestamp.slice(11, 16)}</p>
                  <p className={d.ruleAnomaly ? "text-red-600 font-bold" : d.ifOnlyAnomaly ? "text-violet-600 font-bold" : "text-slate-600"}>
                    {d.value}{limits.unit}{d.ruleAnomaly ? " ⚠ rule deviation" : d.ifOnlyAnomaly ? " ⚠ ML-only anomaly" : ""}
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
            dot={(props: { cx?: number; cy?: number; payload?: { ruleAnomaly?: boolean; ifOnlyAnomaly?: boolean; value?: number | null }; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (payload?.value == null) return <circle key={`d-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
              if (payload.ruleAnomaly)   return <circle key={`r-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />;
              if (payload.ifOnlyAnomaly) return <circle key={`m-${index}`} cx={cx} cy={cy} r={4} fill="white" stroke="#7c3aed" strokeWidth={2} />;
              return <circle key={`n-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
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

// ── Temperature + Pressure dual-axis chart ───────────────────────────────────
function TempPressureChart({ data, height = 160 }: { data: Row[]; height?: number }) {
  const points = data.map((r, i) => ({
    i,
    temp:         r.temperature_c,
    pressure:     r.pressure_bar,
    tempRuleAnom: RULE_BASED_BY_FIELD.temperature_c.has(r.timestamp),
    tempIfAnom:   IF_ONLY_BY_FIELD.temperature_c.has(r.timestamp),
    pressRuleAnom: RULE_BASED_BY_FIELD.pressure_bar.has(r.timestamp),
    pressIfAnom:   IF_ONLY_BY_FIELD.pressure_bar.has(r.timestamp),
    timestamp: r.timestamp,
    step: r.step,
  }));

  const xTicks = (() => {
    const seen = new Set<string>();
    return points.filter(p => {
      const hhmm = p.timestamp.slice(11, 16);
      if (hhmm.endsWith(":00") && !seen.has(hhmm)) { seen.add(hhmm); return true; }
      return false;
    }).map(p => p.i);
  })();

  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-1">
        Temperature &amp; Pressure
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 4, right: 8, left: 8, bottom: 20 }}>
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, points.length - 1]}
            ticks={xTicks}
            tickFormatter={(v: number) => points[v]?.timestamp.slice(11, 16) ?? ""}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          {/* Left Y — Temperature */}
          <YAxis
            yAxisId="temp"
            orientation="left"
            domain={[15, 90]}
            ticks={[15, 30, 45, 60, 75, 90]}
            tickFormatter={(v: number) => `${v}°C`}
            tick={{ fontSize: 10, fill: "#f97316" }}
            axisLine={false}
            tickLine={false}
            width={60}
            label={{ value: "Temperature", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#f97316", fontWeight: 600 } }}
          />
          {/* Right Y — Pressure */}
          <YAxis
            yAxisId="pressure"
            orientation="right"
            domain={[1.0, 5.0]}
            ticks={[1.0, 2.0, 3.0, 4.0, 5.0]}
            tickFormatter={(v: number) => `${v} bar`}
            tick={{ fontSize: 10, fill: "#818cf8" }}
            axisLine={false}
            tickLine={false}
            width={58}
            label={{ value: "Pressure", angle: 90, position: "insideRight", offset: 14, style: { fontSize: 10, fill: "#818cf8", fontWeight: 600 } }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-slate-700">{d.step} · {d.timestamp.slice(11, 16)}</p>
                  {d.temp     != null && <p className={d.tempRuleAnom ? "text-red-600 font-bold" : d.tempIfAnom ? "text-violet-600 font-bold" : "text-orange-600"}>{d.temp}°C{d.tempRuleAnom ? " ⚠ rule" : d.tempIfAnom ? " ⚠ ML" : ""}</p>}
                  {d.pressure != null && <p className={d.pressRuleAnom ? "text-red-600 font-bold" : d.pressIfAnom ? "text-violet-600 font-bold" : "text-indigo-500"}>{d.pressure} bar{d.pressRuleAnom ? " ⚠ rule" : d.pressIfAnom ? " ⚠ ML" : ""}</p>}
                </div>
              );
            }}
          />
          <ReferenceLine yAxisId="temp"     y={77} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine yAxisId="temp"     y={68} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1} />
          <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={1.5} connectNulls={false} isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: { tempRuleAnom?: boolean; tempIfAnom?: boolean; temp?: number | null }; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (payload?.temp == null) return <circle key={`t-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
              if (payload.tempRuleAnom)  return <circle key={`tr-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />;
              if (payload.tempIfAnom)    return <circle key={`tm-${index}`} cx={cx} cy={cy} r={4} fill="white" stroke="#7c3aed" strokeWidth={2} />;
              return <circle key={`tn-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
            }} activeDot={false} />
          <Line yAxisId="pressure" type="monotone" dataKey="pressure" stroke="#818cf8" strokeWidth={1.5} connectNulls={false} isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: { pressRuleAnom?: boolean; pressIfAnom?: boolean; pressure?: number | null }; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (payload?.pressure == null) return <circle key={`p-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
              if (payload.pressRuleAnom)     return <circle key={`pr-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />;
              if (payload.pressIfAnom)       return <circle key={`pm-${index}`} cx={cx} cy={cy} r={4} fill="white" stroke="#7c3aed" strokeWidth={2} />;
              return <circle key={`pn-${index}`} cx={cx} cy={cy} r={0} fill="none" />;
            }} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
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
        <div className="flex items-center gap-4 mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Process parameters over time</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="16" height="10" viewBox="0 0 16 10">
                <line x1="0" y1="5" x2="16" y2="5" stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="4 2"/>
              </svg>
              Acceptable limits
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
              </svg>
              Rule-based anomaly
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4" fill="white" stroke="#7c3aed" strokeWidth="2"/>
              </svg>
              ML-only anomaly
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <TempPressureChart data={rows} />
          <Sparkline data={rows} field="ph"         limits={LIMITS.ph} />
          <Sparkline data={rows} field="mixing_rpm" limits={LIMITS.mixing_rpm} />
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
