"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, type Thread } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    completed: { label: "Completed", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
    awaiting_review: { label: "Awaiting Review", cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500" },
    in_progress: { label: "In Progress", cls: "bg-brown/5 text-brown-lighter", dot: "bg-brown-lighter animate-pulse" },
  };
  const s = map[status] || map.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function HistoryPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

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

  const filtered = filter === "all" ? threads : threads.filter((t) => t.status === filter);
  const tabs = [
    { key: "all", label: "All", count: threads.length },
    { key: "completed", label: "Completed", count: threads.filter((t) => t.status === "completed").length },
    { key: "awaiting_review", label: "Awaiting Review", count: threads.filter((t) => t.status === "awaiting_review").length },
    { key: "in_progress", label: "In Progress", count: threads.filter((t) => t.status === "in_progress").length },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto animate-fade-up">
        <div className="mb-8">
          <span className="eyebrow block mb-2">Archive</span>
          <h1 className="font-serif text-4xl font-bold text-brown mb-3">History</h1>
          <p className="text-brown-lighter">Browse and resume your past research sessions.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                filter === f.key
                  ? "bg-brand text-cream shadow-md"
                  : "bg-cream-dark text-brown-lighter hover:bg-brown/5 border border-brown/5"
              }`}>
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filter === f.key ? "bg-cream/20 text-cream" : "bg-brown/5 text-brown-lighter"
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-brown-lighter">Loading threads...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-brown/10 rounded-3xl animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 rounded-3xl bg-brand/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-brown-lighter font-serif text-xl font-semibold mb-2">No threads found</p>
            <p className="text-brown-lighter/60 text-sm">
              {filter === "all" ? "Start your first research session to see it here." : `No threads with status "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <Link key={t.thread_id} href={`/research/${t.thread_id}`}
                className="group block card card-white card-hover p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg font-semibold text-brown group-hover:text-brand transition-colors leading-snug">
                      {t.query}
                    </p>
                    <div className="flex items-center gap-3 mt-3.5">
                      <span className="text-xs text-brown-lighter/60 font-mono">{t.thread_id.slice(0, 10)}…</span>
                      <span className="w-1 h-1 rounded-full bg-brown-lighter/30" />
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    <div className="w-9 h-9 rounded-xl bg-brown/5 group-hover:bg-brand group-hover:text-cream flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4 text-brown-lighter group-hover:text-cream transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
