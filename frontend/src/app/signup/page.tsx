"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken, ApiError } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const longEnough = password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!longEnough || !hasLetter || !hasNumber) {
      setError("Password must be at least 8 characters with at least one letter and one number.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.signup("User", email, password);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  const requirements = [
    { label: "8+ chars", ok: longEnough },
    { label: "1 letter", ok: hasLetter },
    { label: "1 number", ok: hasNumber },
  ];

  return (
    <div className="flex min-h-screen bg-cream">
      <div className="hidden lg:flex lg:w-1/2 bg-brand items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-white/5" />

        <div className="relative max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-cream/10 ring-1 ring-cream/20 flex items-center justify-center mb-8">
            <svg className="w-7 h-7 text-cream" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="font-serif text-5xl font-bold text-cream leading-tight mb-6">
            Begin your<br />research journey.
          </h1>
          <p className="text-cream/70 text-lg leading-relaxed">
            Create an account to unlock persistent threads, long-term memory, and cited reports.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <span className="font-serif text-xl font-bold text-brown mb-8 block lg:hidden">DERVE</span>
          <h2 className="font-serif text-3xl font-bold text-brown mb-2">Create your account</h2>
          <p className="text-brown-lighter mb-9">Set up your research workspace in seconds.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-line" placeholder="you@example.com" autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-line" placeholder="••••••••" autoComplete="new-password"
              />
              <div className="flex gap-3 mt-3">
                {requirements.map((r) => (
                  <span key={r.label}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                      r.ok ? "text-brand" : "text-brown-lighter/70"
                    }`}>
                    <span className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                      r.ok ? "border-brand bg-brand/10" : "border-brown-lighter/40"
                    }`}>
                      {r.ok && (
                        <svg className="w-2 h-2 text-brand" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    {r.label}
                  </span>
                ))}
              </div>
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
                  Creating account…
                </span>
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-brown-lighter">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand underline underline-offset-4 hover:text-brand-light transition-colors">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
