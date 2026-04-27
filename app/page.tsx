"use client";
import { useState } from "react";
import InputPanel from "@/components/InputPanel";
import MetricsBar from "@/components/MetricsBar";
import DeviationTable from "@/components/DeviationTable";
import DeviationDetail from "@/components/DeviationDetail";
import ChatWidget from "@/components/ChatWidget";
import ExportButton from "@/components/ExportButton";
import { AnalysisResult } from "@/lib/types";

const DEMO_SCENARIOS = [
  {
    id: "B441",
    label: "Batch B441 — Sterile Injectable",
    description: "5 injected deviations: temperature spike, multivariate anomaly, pH sensor drift, out-of-context RPM, SCADA data gap.",
    file: "/demo_batch_B441.csv",
    filename: "batch_log_B441.csv",
  },
];

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

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
      setResult(await res.json());
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
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Deviation Detective</h1>
          <p className="text-xs text-slate-500 mt-0.5">Pharmaceutical Manufacturing · Process Quality</p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <ExportButton result={result} />
            <button
              onClick={() => setShowChat(v => !v)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              {showChat ? "Hide Copilot" : "Investigation Copilot"}
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 flex flex-col gap-6">

        {/* ── Intro banner ── */}
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-7 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex flex-col gap-2 max-w-2xl">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">MVP · Job Application Demo</span>
                <h2 className="text-2xl font-bold text-slate-900 leading-snug">
                  Automated process deviation detection for pharmaceutical manufacturing
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Upload a production batch log (CSV) — the system uses <strong>Isolation Forest</strong> to flag
                  statistical anomalies, then a <strong>large language model</strong> explains each deviation in
                  business language, identifies probable root causes, assigns a risk level, and generates a
                  non-conformity report. An investigation copilot lets you ask follow-up questions.
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Built by Samuel — applying for AI Product Builder (Digital PO) · Sanofi M&amp;S Accelerator
                </p>
              </div>

              {/* Demo scenarios */}
              <div className="flex flex-col gap-2 min-w-64">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Demo scenarios</p>
                {DEMO_SCENARIOS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => runDemo(s)}
                    className="text-left rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-colors px-4 py-3 group"
                  >
                    <p className="text-sm font-semibold text-blue-800 group-hover:text-blue-900">{s.label}</p>
                    <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">{s.description}</p>
                    <p className="text-xs font-bold text-blue-700 mt-2">▶ Launch this demo →</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

        <InputPanel onAnalyze={runAnalysis} loading={loading} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && (
          <>
            <MetricsBar result={result} />
            <div className={`grid gap-6 ${selectedDeviation ? "grid-cols-2" : "grid-cols-1"}`}>
              <DeviationTable
                deviations={result.deviations}
                selected={selected}
                onSelect={(id) => setSelected(prev => prev === id ? null : id)}
              />
              {selectedDeviation && <DeviationDetail deviation={selectedDeviation} />}
            </div>
            {showChat && <ChatWidget result={result} />}
          </>
        )}
      </main>
    </div>
  );
}
