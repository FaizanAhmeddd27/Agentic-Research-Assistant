"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, type Thread } from "@/lib/api";

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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-16">
          <h1 className="font-serif text-4xl lg:text-5xl font-bold text-brown mb-4">Dashboard</h1>
          <p className="text-brown-lighter text-lg max-w-xl">
            Start a new research session or pick up where you left off.
          </p>
        </div>

        {/* New Research CTA */}
        <Link href="/research/new" className="group block mb-16 p-8 bg-brand rounded-2xl shadow-xl hover:scale-[1.01] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold text-cream mb-2">Start New Research</h2>
              <p className="text-cream/70">Ask a question and let the agent plan, retrieve, and write.</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-cream/10 flex items-center justify-center group-hover:bg-cream/20 transition-colors">
              <svg className="w-7 h-7 text-cream" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        </Link>

        {/* Recent Threads */}
        <div>
          <h2 className="font-serif text-2xl font-bold text-brown mb-6">Recent Threads</h2>
          {loading ? (
            <p className="text-brown-lighter">Loading...</p>
          ) : threads.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-brown/10 rounded-2xl">
              <p className="text-brown-lighter text-lg mb-2">No threads yet</p>
              <p className="text-brown-lighter/60 text-sm">Your research history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {threads.slice(0, 10).map((t) => (
                <Link key={t.thread_id} href={`/research/${t.thread_id}`}
                  className="block p-5 bg-cream-dark rounded-2xl border border-brown/5 hover:border-brand/20 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brown truncate">{t.query}</p>
                      <p className="text-xs text-brown-lighter mt-1">{t.thread_id.slice(0, 8)}...</p>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                      t.status === "completed" ? "bg-brand/10 text-brand" :
                      t.status === "awaiting_review" ? "bg-amber-100 text-amber-700" :
                      "bg-brown/5 text-brown-lighter"
                    }`}>
                      {t.status === "awaiting_review" ? "Review" : t.status === "completed" ? "Done" : "Running"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
