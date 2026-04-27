"use client";
import { useState, useRef, useEffect } from "react";
import { AnalysisResult } from "@/lib/types";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatWidget({ result }: { result: AnalysisResult }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          analysis: result.deviations,
          batch_summary: { batch_id: result.batch_id, total_rows: result.total_rows, steps: result.steps },
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.answer }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col" style={{ height: 420 }}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <h3 className="font-semibold text-slate-800 text-sm">Investigation Copilot</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-slate-400 text-sm text-center mt-8">
            Ask anything about this batch — deviations, root causes, next steps…
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-800"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-4 py-2.5 text-slate-400 text-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-violet-400"
          placeholder="e.g. What corrective action for DEV-03?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-medium disabled:opacity-40 hover:bg-violet-800 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
