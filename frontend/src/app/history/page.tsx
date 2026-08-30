"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, type Thread } from "@/lib/api";

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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="font-serif text-4xl font-bold text-brown mb-2">History</h1>
        <p className="text-brown-lighter mb-8">Browse and resume your past research sessions.</p>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { key: "all", label: "All" },
            { key: "completed", label: "Completed" },
            { key: "awaiting_review", label: "Awaiting Review" },
            { key: "in_progress", label: "In Progress" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                filter === f.key
                  ? "bg-brand text-cream shadow-md"
                  : "bg-cream-dark text-brown-lighter hover:bg-brown/5 border border-brown/5"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-brown-lighter">Loading threads...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-brown/10 rounded-2xl">
            <svg className="w-12 h-12 mx-auto text-brown-lighter/30 mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-brown-lighter text-lg mb-1">No threads found</p>
            <p className="text-brown-lighter/50 text-sm">
              {filter === "all" ? "Start your first research session to see it here." : `No threads with status "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <Link key={t.thread_id} href={`/research/${t.thread_id}`}
                className="group block p-6 bg-cream-dark rounded-2xl border border-brown/5 hover:border-brand/20 hover:shadow-lg transition-all duration-300">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg font-semibold text-brown group-hover:text-brand transition-colors leading-snug">
                      {t.query}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-brown-lighter/60 font-mono">{t.thread_id.slice(0, 8)}</span>
                      <span className="text-brown-lighter/20">|</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                        t.status === "completed" ? "bg-brand/10 text-brand" :
                        t.status === "awaiting_review" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-brown/5 text-brown-lighter"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "completed" ? "bg-brand" :
                          t.status === "awaiting_review" ? "bg-amber-500" :
                          "bg-brown-lighter"
                        }`} />
                        {t.status === "awaiting_review" ? "Awaiting Review" : t.status === "completed" ? "Completed" : "In Progress"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    <svg className="w-5 h-5 text-brown-lighter/30 group-hover:text-brand group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
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
