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
      <div className="hidden lg:flex lg:w-1/2 bg-brand items-center justify-center p-16">
        <div className="max-w-md">
          <h1 className="font-serif text-5xl font-bold text-cream leading-tight mb-6">
            Research,<br />refined.
          </h1>
          <p className="text-cream/70 text-lg leading-relaxed">
            Multi-step AI research with cited reports, self-critique, and long-term memory.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-3xl font-bold text-brown mb-2">Welcome back</h2>
          <p className="text-brown-lighter mb-8">Log in to your research assistant.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-brown-lighter mb-2">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b-2 border-brown/10 py-3 text-brown placeholder-brown-lighter/50 focus:border-brand transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-brown-lighter mb-2">Password</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b-2 border-brown/10 py-3 text-brown placeholder-brown-lighter/50 focus:border-brand transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-brand text-cream py-4 rounded-btn text-[13px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform shadow-xl disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
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
