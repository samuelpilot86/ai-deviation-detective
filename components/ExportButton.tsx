"use client";
import { useState } from "react";
import { AnalysisResult } from "@/lib/types";

export default function ExportButton({ result }: { result: AnalysisResult }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: result.batch_id,
          total_rows: result.total_rows,
          steps: result.steps,
          deviations: result.deviations,
        }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `non_conformity_${result.batch_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium disabled:opacity-40 hover:bg-slate-700 transition-colors flex items-center gap-2"
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0-3-3m3 3 3-3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
        </svg>
      )}
      {loading ? "Generating…" : "Export PDF Report"}
    </button>
  );
}
