"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";

export default function NewResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const tid = crypto.randomUUID();
    router.push(`/research/${tid}?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-16">
        <h1 className="font-serif text-4xl lg:text-5xl font-bold text-brown mb-4">New Research</h1>
        <p className="text-brown-lighter text-lg mb-12">What do you want to research?</p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            rows={4}
            className="w-full bg-cream-dark border-2 border-brown/10 rounded-2xl p-6 text-brown text-lg placeholder-brown-lighter/50 focus:border-brand transition-colors resize-none"
            placeholder="e.g. Compare the performance of PostgreSQL vs SQLite for concurrent read-heavy workloads..."
          />
          <div className="flex justify-end mt-6">
            <button type="submit" disabled={loading || !query.trim()}
              className="bg-brand text-cream px-10 py-4 rounded-btn text-[13px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform shadow-xl disabled:opacity-40">
              {loading ? "Starting..." : "Start Research"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
