"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Left: decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand items-center justify-center p-16 relative overflow-hidden">
        {/* Decorative rings */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-[28rem] h-[28rem] rounded-full bg-white/5" />
        <div className="absolute top-1/3 left-1/4 w-2 h-2 rounded-full bg-cream/30 animate-pulse" />

        <div className="relative max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-cream/10 ring-1 ring-cream/20 flex items-center justify-center mb-8">
            <svg className="w-7 h-7 text-cream" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="font-serif text-5xl font-bold text-cream leading-tight mb-6">
            Research,<br />refined.
          </h1>
          <p className="text-cream/70 text-lg leading-relaxed">
            Multi-step AI research with cited reports, self-critique, and long-term memory.
          </p>
          <div className="mt-10 flex gap-3">
            {["Plan", "Retrieve", "Critique", "Write"].map((s) => (
              <span key={s} className="px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cream/10 text-cream/80 ring-1 ring-cream/15">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <span className="font-serif text-xl font-bold text-brown mb-8 block lg:hidden">DERVE</span>
          <h2 className="font-serif text-3xl font-bold text-brown mb-2">Welcome back</h2>
          <p className="text-brown-lighter mb-9">Log in to your research assistant.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-line"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-line"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in" role="alert">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                  Logging in…
                </span>
              ) : (
                "Log in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-brown-lighter">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-brand underline underline-offset-4 hover:text-brand-light transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
