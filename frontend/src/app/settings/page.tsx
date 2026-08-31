"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, type Document, type Settings as SettingsType } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType>({ llm_provider: "groq", web_search_enabled: true });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    Promise.all([api.getSettings(), api.listDocuments()])
      .then(([s, d]) => { setSettings(s); setDocuments(d.documents); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    try {
      await api.updateSettings(settings);
      setSaveMsg("Settings saved");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch { /* ignore */ }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadDocument(file);
      setDocuments((d) => [{ id: result.id, filename: result.filename, mime_type: "", size_bytes: file.size, uploaded_at: null }, ...d]);
    } catch { /* ignore */ }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDeleteDoc(id: string) {
    try {
      await api.deleteDocument(id);
      setDocuments((d) => d.filter((doc) => doc.id !== id));
    } catch { /* ignore */ }
  }

  if (loading) return <AppLayout><div className="text-brown-lighter p-10">Loading...</div></AppLayout>;

  const providers = [
    { key: "groq", name: "Groq", desc: "Fast, open-weight models" },
    { key: "gemini", name: "Gemini", desc: "Google's Gemini models" },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-up">
        <div className="mb-10">
          <span className="eyebrow block mb-2">Preferences</span>
          <h1 className="font-serif text-4xl font-bold text-brown mb-3">Settings</h1>
          <p className="text-brown-lighter">Configure your research assistant.</p>
        </div>

        {/* Agent Preferences */}
        <section className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-brown mb-5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </span>
            Agent Preferences
          </h2>
          <div className="card card-white p-6 md:p-7 space-y-7">
            {/* LLM Provider */}
            <div>
              <label className="field-label">LLM Provider</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {providers.map((p) => {
                  const selected = settings.llm_provider === p.key;
                  return (
                    <button key={p.key}
                      onClick={() => setSettings((s) => ({ ...s, llm_provider: p.key }))}
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selected
                          ? "border-brand bg-brand/5"
                          : "border-brown/10 bg-cream-dark hover:border-brand/30"
                      }`}>
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? "border-brand bg-brand" : "border-brown-lighter/40"
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-cream" />}
                      </div>
                      <div>
                        <p className={`font-serif text-base font-bold ${selected ? "text-brand" : "text-brown"}`}>{p.name}</p>
                        <p className="text-xs text-brown-lighter mt-0.5">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Web Search Toggle */}
            <div className="flex items-center justify-between gap-4 pt-6 border-t border-brown/5">
              <div className="min-w-0 flex-1">
                <label className="field-label mb-1!">Web Search</label>
                <p className="text-xs text-brown-lighter/70 max-w-xs">Allow the agent to search the live web for additional sources.</p>
              </div>
              <button onClick={() => setSettings((s) => ({ ...s, web_search_enabled: !s.web_search_enabled }))}
                aria-pressed={settings.web_search_enabled}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 cursor-pointer ${
                  settings.web_search_enabled ? "bg-brand shadow-inner" : "bg-brown/20"
                }`}>
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  settings.web_search_enabled ? "left-7" : "left-1"
                }`} />
              </button>
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-brown/5">
              <button onClick={handleSave} className="btn btn-primary">
                Save Settings
              </button>
              {saveMsg && (
                <span className="text-sm text-brand font-medium inline-flex items-center gap-1.5 animate-fade-in">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Documents */}
        <section>
          <h2 className="font-serif text-2xl font-bold text-brown mb-5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
            Documents
          </h2>
          <div className="card card-white p-6 md:p-7">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-brown-lighter">{documents.length} document{documents.length !== 1 ? "s" : ""} uploaded</p>
              <label className="btn btn-primary cursor-pointer py-2.5! px-5!">
                {uploading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                     Uploading…

                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Upload
                  </>
                )}
                <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-brown/10 rounded-2xl">
                <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-brown-lighter font-serif font-semibold mb-1.5">No documents yet</p>
                <p className="text-sm text-brown-lighter/60">Upload PDF, TXT, or MD files to ground your research.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4 bg-cream-dark rounded-xl border border-brown/5 group/anchor">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-brown truncate">{d.filename}</p>
                        <p className="text-xs text-brown-lighter">{(d.size_bytes / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteDoc(d.id)} aria-label={`Delete ${d.filename}`}
                      className="shrink-0 p-2 text-brown-lighter hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
