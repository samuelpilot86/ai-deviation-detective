"use client";
import { useState } from "react";
type Tab = "demo" | "csv";
import InputPanel from "@/components/InputPanel";
import MetricsBar from "@/components/MetricsBar";
import DeviationTable from "@/components/DeviationTable";
import DeviationDetail from "@/components/DeviationDetail";
import ChatWidget from "@/components/ChatWidget";
import ExportButton from "@/components/ExportButton";
import BatchPreview from "@/components/BatchPreview";
import { AnalysisResult } from "@/lib/types";

const DEMO_SCENARIOS = [
  {
    id: "B441",
    label: "Batch B441 — Sterile Injectable",
    description: "4 process deviations to be detected: temperature spike, pH sensor drift, out-of-context agitator speed, SCADA data gap.",
    file: "/demo_batch_B441.csv",
    filename: "batch_log_B441.csv",
  },
];

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("demo");

  async function runAnalysis(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
      const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const top = [...data.deviations].sort((a, b) => {
        const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
        if (riskDiff !== 0) return riskDiff;
        return a.timestamp < b.timestamp ? -1 : 1;
      })[0];
      if (top) setSelected(top.deviation_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function runDemo(scenario: typeof DEMO_SCENARIOS[0]) {
    const res = await fetch(scenario.file);
    const blob = await res.blob();
    runAnalysis(new File([blob], scenario.filename, { type: "text/csv" }));
  }

  const selectedDeviation = result?.deviations.find(d => d.deviation_id === selected) ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#6366B4"/>
            <polyline points="2,22 8,22 11,25 13,19 16,28 19,10 22,26 24,22 30,22"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="33" cy="11" r="4.5" stroke="white" strokeWidth="2" fill="none"/>
            <circle cx="33" cy="11" r="1.8" fill="white"/>
          </svg>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">AI Deviation Detective</h1>
            <p className="text-xs text-slate-500">Pharmaceutical Manufacturing · Process Quality · <span className="text-violet-600 font-medium">Job application demo by Samuel Pilot</span></p>
          </div>
        </div>
        {result && <ExportButton result={result} />}
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 flex flex-col gap-6">

        {/* ── 1. Presentation ── */}
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-7">
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wider">MVP · Job Application Demo</span>
          <h2 className="text-2xl font-bold text-slate-900 leading-snug mt-1">
            Automated process deviation detection for pharmaceutical manufacturing
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mt-5 max-w-4xl">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">The problem</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                Pharmaceutical production batches generate hundreds of sensor readings across multiple steps.
                A QA expert spends <strong>30–60 minutes</strong> triaging deviations per batch — and subtle issues
                (sensor drift, out-of-context values, data gaps) often slip through.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">This MVP</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                <strong>Isolation Forest</strong> + business rules pre-filter suspicious rows.
                A <strong>large language model</strong> then explains each deviation, suggests root causes, assigns risk,
                and drafts a non-conformity report. <strong>~10 seconds per batch.</strong> An investigation copilot answers follow-up questions.
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. Input data ── */}
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="px-8 pt-5 pb-1">
            <h3 className="text-base font-semibold text-slate-800">Input data</h3>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-8 mt-2">
            {(["csv", "demo"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === t
                    ? "border-b-2 border-violet-600 text-violet-700"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {t === "csv" ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Upload CSV</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Demo</>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-8 py-6">
            {tab === "csv" && <InputPanel onAnalyze={runAnalysis} loading={loading} embedded />}
            {tab === "demo" && (
              <div className="flex flex-col gap-6">
                {DEMO_SCENARIOS.map(s => (
                  <div key={s.id} className="flex flex-col gap-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                      </div>
                      <button
                        onClick={() => runDemo(s)}
                        disabled={loading}
                        className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-700 text-white text-sm font-semibold hover:bg-violet-800 disabled:opacity-40 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        {loading ? "Analyzing…" : "Run analysis"}
                      </button>
                    </div>
                    <BatchPreview csvPath={s.file} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Analysis ── */}
        {(error || result) && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-slate-800 px-1">Analysis</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {result && (
              <>
                <MetricsBar result={result} />
                <div className={`grid gap-6 ${selectedDeviation ? "grid-cols-[3fr_2fr]" : "grid-cols-1"}`}>
                  <DeviationTable
                    deviations={result.deviations}
                    selected={selected}
                    onSelect={(id) => setSelected(prev => prev === id ? null : id)}
                  />
                  {selectedDeviation && <DeviationDetail deviation={selectedDeviation} />}
                </div>
                <ChatWidget result={result} />
              </>
            )}
          </div>
        )}

      </main>

      <footer className="border-t border-slate-200 bg-white mt-8 px-8 py-5">
        <p className="text-xs text-slate-400">
          <span className="font-medium text-slate-500">AI Deviation Detective</span> — Independent MVP built as part of a job application.
          Not affiliated with or endorsed by Sanofi. All data used in this demo is synthetic.
        </p>
      </footer>
    </div>
  );
}
