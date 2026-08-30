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
      setTimeout(() => setSaveMsg(""), 2000);
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="font-serif text-4xl font-bold text-brown mb-4">Settings</h1>
        <p className="text-brown-lighter mb-10">Configure your research assistant.</p>

        {/* Agent Preferences */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-brown mb-6">Agent Preferences</h2>
          <div className="bg-cream-dark rounded-2xl border border-brown/5 p-6 space-y-6">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-brown-lighter mb-3">LLM Provider</label>
              <div className="flex gap-3">
                {["groq", "gemini"].map((p) => (
                  <button key={p} onClick={() => setSettings((s) => ({ ...s, llm_provider: p }))}
                    className={`px-6 py-3 rounded-xl text-sm font-semibold capitalize transition-colors ${
                      settings.llm_provider === p ? "bg-brand text-cream" : "bg-white text-brown border border-brown/10 hover:border-brand/30"
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] font-bold text-brown-lighter mb-1">Web Search</label>
                <p className="text-xs text-brown-lighter/60">Allow the agent to search the web for sources.</p>
              </div>
              <button onClick={() => setSettings((s) => ({ ...s, web_search_enabled: !s.web_search_enabled }))}
                className={`relative w-12 h-7 rounded-full transition-colors ${settings.web_search_enabled ? "bg-brand" : "bg-brown/20"}`}>
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.web_search_enabled ? "left-6" : "left-1"}`} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSave}
                className="bg-brand text-cream px-8 py-3 rounded-btn text-[12px] font-bold uppercase tracking-[0.15em] hover:scale-[1.02] transition-transform">
                Save Settings
              </button>
              {saveMsg && <span className="text-sm text-brand font-medium">{saveMsg}</span>}
            </div>
          </div>
        </section>

        {/* Documents */}
        <section>
          <h2 className="font-serif text-2xl font-bold text-brown mb-6">Documents</h2>
          <div className="bg-cream-dark rounded-2xl border border-brown/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-brown-lighter">{documents.length} document{documents.length !== 1 ? "s" : ""} uploaded</p>
              <label className="bg-brand text-cream px-6 py-3 rounded-btn text-[12px] font-bold uppercase tracking-[0.15em] hover:scale-[1.02] transition-transform cursor-pointer">
                {uploading ? "Uploading..." : "Upload"}
                <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-brown-lighter/60 text-center py-8">No documents yet. Upload PDF, TXT, or MD files.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-brown/5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brown truncate">{d.filename}</p>
                      <p className="text-xs text-brown-lighter">{(d.size_bytes / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={() => handleDeleteDoc(d.id)}
                      className="shrink-0 p-2 text-brown-lighter hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
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
