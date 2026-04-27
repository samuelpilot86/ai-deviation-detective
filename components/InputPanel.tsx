"use client";
import { useRef, useState } from "react";

interface Props {
  onAnalyze: (file: File) => void;
  loading: boolean;
  embedded?: boolean;
}

export default function InputPanel({ onAnalyze, loading, embedded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) return;
    setFile(f);
  }

  const inner = (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Upload Batch Log</h2>
          <p className="text-sm text-slate-500 mt-1">CSV format — columns: timestamp, batch_id, step, temperature_c, pressure_bar, ph, mixing_rpm</p>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-slate-500">CSV format — columns: timestamp, batch_id, step, temperature_c, pressure_bar, ph, mixing_rpm</p>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? "border-violet-400 bg-violet-50" : "border-slate-300 hover:border-slate-400"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
        </svg>
        {file
          ? <span className="text-sm font-medium text-slate-700">{file.name}</span>
          : <span className="text-sm text-slate-500">Drop a CSV file here, or click to browse</span>
        }
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      <button
        disabled={!file || loading}
        onClick={() => file && onAnalyze(file)}
        className="w-full py-3 rounded-xl bg-violet-700 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-800 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Analyzing…
          </>
        ) : "Run Analysis"}
      </button>
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8">
      {inner}
    </div>
  );
}
