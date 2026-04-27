import { Deviation, RiskLevel } from "@/lib/types";

const riskColors: Record<RiskLevel, string> = {
  HIGH:   "border-red-300 bg-red-50",
  MEDIUM: "border-amber-300 bg-amber-50",
  LOW:    "border-green-300 bg-green-50",
};
const riskBadge: Record<RiskLevel, string> = {
  HIGH:   "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW:    "bg-green-100 text-green-700",
};

export default function DeviationDetail({ deviation }: { deviation: Deviation }) {
  return (
    <div className={`rounded-2xl border-2 p-6 flex flex-col gap-4 ${riskColors[deviation.risk_level]}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-base">{deviation.deviation_id} — {deviation.step}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskBadge[deviation.risk_level]}`}>
          {deviation.risk_level}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Detail label="Parameter"        value={deviation.parameter} />
        <Detail label="Observed"         value={deviation.observed_value} />
        <Detail label="Acceptable range" value={deviation.acceptable_range} />
        <Detail label="Timestamp"        value={deviation.timestamp} mono />
      </div>

      <Section label="Explanation">
        <p className="text-slate-700 text-sm leading-relaxed">{deviation.explanation}</p>
      </Section>

      <Section label="Probable Root Causes">
        <ul className="list-disc list-inside text-slate-700 text-sm space-y-1">
          {deviation.probable_root_causes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </Section>

      <Section label="Recommended Action">
        <p className="text-slate-700 text-sm leading-relaxed font-medium">{deviation.recommended_action}</p>
      </Section>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-slate-800 mt-0.5 ${mono ? "font-mono text-xs" : "text-sm font-medium"}`}>{value}</p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}
