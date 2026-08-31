"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, type MemoryEntry } from "@/lib/api";

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    api.listMemory().then((r) => setMemories(r.memories)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleDelete(key: string) {
    try {
      await api.deleteMemory(key);
      setMemories((m) => m.filter((e) => e.key !== key));
    } catch { /* ignore */ }
    setConfirmDelete(null);
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <span className="eyebrow block mb-2">Long-Term Context</span>
          <h1 className="font-serif text-4xl font-bold text-brown mb-3">Memory</h1>
          <p className="text-brown-lighter">What the system has learned about your interests across sessions.</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="text-brown-lighter">Loading memories...</span>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-brown/10 rounded-3xl">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-brown-lighter font-serif text-xl font-semibold mb-2">No memories yet</p>
            <p className="text-brown-lighter/60 text-sm max-w-sm mx-auto mb-6">Memories are captured automatically after completing research sessions.</p>
            <Link href="/research/new" className="btn btn-primary">Start a Research Session</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memories.map((m) => {
              const summary = m.summary || m.value || m.key;
              const created = m.created_at ? new Date(m.created_at).toLocaleDateString() : "";
              return (
                <div key={m.key} className="card card-hover card-white p-5 flex items-start justify-between gap-4 animate-fade-up">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="chip bg-brand/10 text-brand capitalize">{m.category || "general"}</span>
                    </div>
                    <p className="text-[13px] text-brown-light leading-relaxed">{summary}</p>
                    {created && (
                      <p className="text-[11px] text-brown-lighter/70 mt-3 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {created}
                      </p>
                    )}
                  </div>
                  {confirmDelete === m.key ? (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => handleDelete(m.key)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-brown-lighter hover:bg-brown/5 transition-colors cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.key)} aria-label="Delete memory"
                      className="shrink-0 p-2 text-brown-lighter hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
