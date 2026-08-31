"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";

const SUGGESTIONS = [
  "Compare Postgres and SQLite for concurrent read-heavy workloads",
  "Explain how retrieval-augmented generation reduces AI hallucination",
  "What are the tradeoffs of event sourcing vs CRUD in distributed systems?",
];

export default function NewResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  function start(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    const tid = crypto.randomUUID();
    router.push(`/research/${tid}?q=${encodeURIComponent(q.trim())}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(query);
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-12 animate-fade-up">
        <span className="eyebrow block mb-2">Compose Inquiry</span>
        <h1 className="font-serif text-4xl lg:text-5xl font-bold text-brown mb-3">New Research</h1>
        <p className="text-brown-lighter text-lg mb-10">What do you want to research?</p>

        <form onSubmit={handleSubmit} className="bg-cream-dark rounded-3xl border border-brown/5 p-6 md:p-8 shadow-sm">
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full bg-white border-2 border-brown/10 rounded-2xl p-5 text-brown text-base leading-relaxed placeholder-brown-lighter/50 focus:border-brand resize-none transition-colors shadow-inner"
            placeholder="e.g. Compare the performance of PostgreSQL vs SQLite for concurrent read-heavy workloads..."
            autoFocus
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-[11px] text-brown-lighter/70 font-mono">{query.length}/2000</span>
            <button type="submit" disabled={loading || !query.trim()} className="btn btn-primary">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                   Starting…

                </span>
              ) : (
                <>
                  Start Research
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggestions */}
        <div className="mt-8">
          <p className="field-label mb-3!">Or start with an example</p>
          <div className="space-y-2.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => start(s)} disabled={loading}
                className="w-full text-left card card-white card-hover p-4 flex items-center justify-between gap-4 group">
                <span className="text-sm text-brown-light group-hover:text-brown transition-colors">{s}</span>
                <svg className="w-4 h-4 text-brown-lighter group-hover:text-brand group-hover:translate-x-1 transition-all shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
