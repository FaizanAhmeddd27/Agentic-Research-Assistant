"use client";

import { useEffect, useState } from "react";
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
        <h1 className="font-serif text-4xl font-bold text-brown mb-4">Memory</h1>
        <p className="text-brown-lighter mb-8">What the system has learned about your interests across sessions.</p>

        {loading ? <p className="text-brown-lighter">Loading...</p> : memories.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-brown/10 rounded-2xl">
            <p className="text-brown-lighter text-lg mb-2">No memories yet</p>
            <p className="text-brown-lighter/60 text-sm">Memory entries are created automatically after completing research sessions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((m) => {
              const summary = m.summary || m.value || m.key;
              return (
                <div key={m.key} className="flex items-start justify-between gap-4 p-5 bg-cream-dark rounded-2xl border border-brown/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-brown text-sm leading-relaxed">{summary}</p>
                    {m.category && <p className="text-[10px] uppercase tracking-[0.2em] text-brown-lighter mt-2">{m.category}</p>}
                    <p className="text-xs text-brown-lighter mt-2 break-all">{m.key}</p>
                  </div>
                  {confirmDelete === m.key ? (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleDelete(m.key)} className="text-xs font-semibold text-red-600 hover:text-red-700">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-brown-lighter hover:text-brown">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.key)}
                      className="shrink-0 p-2 text-brown-lighter hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
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
