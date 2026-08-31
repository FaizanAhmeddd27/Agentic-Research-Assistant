"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, type Thread } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    completed: { label: "Completed", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
    awaiting_review: { label: "Review", cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
    in_progress: { label: "Running", cls: "bg-brown/5 text-brown-lighter", dot: "bg-brown-lighter animate-pulse" },
  };
  const s = map[status] || map.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadThreads = () => {
      setLoading(true);
      api.listThreads()
        .then((r) => setThreads(r.threads))
        .catch(() => setThreads([]))
        .finally(() => setLoading(false));
    };

    loadThreads();
    window.addEventListener("auth:change", loadThreads);
    return () => window.removeEventListener("auth:change", loadThreads);
  }, []);

  const completed = threads.filter((t) => t.status === "completed").length;
  const review = threads.filter((t) => t.status === "awaiting_review").length;
  const running = threads.filter((t) => t.status === "in_progress").length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-12 animate-fade-up">
          <span className="eyebrow block mb-2">Workspace Overview</span>
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-brown mb-4">Dashboard</h1>
          <p className="text-brown-lighter text-lg max-w-xl">
            Start a new research session or pick up where you left off.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-10">
          {[
            { label: "Completed", value: completed, icon: "M4.5 12.75l6 6 9-13.5" },
            { label: "Awaiting Review", value: review, icon: "M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" },
            { label: "Running", value: running, icon: "M6 14.25H3v-6h3m0 0l3-3h6.5a2.25 2.25 0 012.25 2.25v6.75A2.25 2.25 0 0115.75 16.5H9m3 0v6m-3-6l3 3m0-6l-3 3" },
          ].map((s) => (
            <div key={s.label} className="card card-white p-3 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-serif text-2xl sm:text-2xl font-bold text-brown leading-none mb-1">{s.value}</p>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-brown-lighter truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* New Research CTA */}
        <Link href="/research/new" className="group block mb-12 p-8 md:p-10 bg-brand rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center sm:gap-6">
            <div>
              <span className="eyebrow text-cream/70! mb-2 block">Begin Research</span>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-cream mb-2">Start New Research</h2>
              <p className="text-cream/70">Ask a question and let the agent plan, retrieve, and write.</p>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-cream/10 ring-1 ring-cream/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-cream/20 transition-all">
              <svg className="w-7 h-7 md:w-8 md:h-8 text-cream" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Recent Threads */}
        <div className="animate-fade-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-brown">Recent Threads</h2>
            <Link href="/history" className="text-sm font-semibold text-brand hover:text-brand-light transition-colors flex items-center gap-1">
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-10">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <span className="text-brown-lighter">Loading threads...</span>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-brown/10 rounded-3xl">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
              </div>
              <p className="text-brown-lighter font-serif text-lg font-semibold mb-2">No threads yet</p>
              <p className="text-brown-lighter/60 text-sm mb-6">Your research history will appear here.</p>
              <Link href="/research/new" className="btn btn-primary">Start your first research</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.slice(0, 10).map((t) => (
                <Link key={t.thread_id} href={`/research/${t.thread_id}`}
                  className="card card-white card-hover p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brown truncate">{t.query}</p>
                    <p className="text-xs text-brown-lighter mt-1.5 font-mono">{t.thread_id.slice(0, 10)}…</p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
