"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { api, getToken, type Source } from "@/lib/api";

interface NodeEvent {
  node: string;
  status: string;
  [key: string]: unknown;
}

interface StreamState {
  status: "idle" | "streaming" | "awaiting_review" | "completed" | "error";
  nodes: NodeEvent[];
  sources: Source[];
  draftReport: string;
  finalReport: string;
  query: string;
  error: string;
  subQuestions: string[];
}

const NODE_LABELS: Record<string, string> = {
  planner: "Planning",
  retriever: "Retrieving",
  critique: "Critiquing",
  writer: "Writing",
  hitl_review: "Review",
  process_review: "Processing",
  finalize: "Finalizing",
};

export default function ResearchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const threadId = params.thread_id as string;
  const query = searchParams.get("q") || "";

  const [state, setState] = useState<StreamState>({
    status: "idle",
    nodes: [],
    sources: [],
    draftReport: "",
    finalReport: "",
    query,
    error: "",
    subQuestions: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copied, setCopied] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Start streaming on mount if this is a new run with query parameter
  useEffect(() => {
    if (!query || state.status !== "idle") return;

    setState((s) => ({ ...s, status: "streaming", query }));

    const url = api.streamUrl(threadId, query);
    const token = getToken();
    const esUrl = token ? `${url}&token=${token}` : url;
    const es = new EventSource(esUrl);
    eventSourceRef.current = es;

    es.addEventListener("thread", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setState((s) => ({ ...s, query: data.query || s.query }));
      } catch {}
    });

    es.addEventListener("node", (e: MessageEvent) => {
      try {
        const data: NodeEvent = JSON.parse(e.data);
        setState((s) => {
          const src =
            data.node === "retriever" && Array.isArray(data.sources)
              ? (data.sources as Source[])
              : s.sources;

          const draft =
            typeof data.draft_report === "string" && data.draft_report
              ? data.draft_report
              : s.draftReport;

          const final =
            data.node === "finalize" && typeof data.final_report === "string" && data.final_report
              ? data.final_report
              : s.finalReport;

          const subQs =
            data.node === "planner" && Array.isArray(data.sub_questions)
              ? (data.sub_questions as string[])
              : s.subQuestions;

          return {
            ...s,
            nodes: [...s.nodes, data],
            sources: src,
            draftReport: draft,
            finalReport: final,
            subQuestions: subQs,
          };
        });
      } catch {}
    });

    es.addEventListener("status", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setState((s) => {
          const nextStatus =
            data.status === "awaiting_review"
              ? "awaiting_review"
              : data.status === "completed"
              ? "completed"
              : s.status;

          const draft = data.draft_report || s.draftReport;
          const final = data.final_report || (data.status === "completed" ? draft : s.finalReport);

          return {
            ...s,
            status: nextStatus,
            draftReport: draft,
            finalReport: final,
          };
        });
      } catch {}
    });

    es.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = e.data ? JSON.parse(e.data) : null;
        if (data?.message) {
          setState((s) => ({ ...s, status: s.draftReport ? s.status : "error", error: data.message }));
        }
      } catch {}
    });

    es.addEventListener("done", () => {
      es.close();
      setState((s) => {
        if (s.status === "streaming") {
          return {
            ...s,
            status: s.draftReport ? "awaiting_review" : s.finalReport ? "completed" : "completed",
          };
        }
        return s;
      });
    });

    es.onerror = () => {
      es.close();
      setState((s) => {
        // If we already have a draft or final report, do not show fatal error
        if (s.draftReport || s.finalReport) {
          return {
            ...s,
            status: s.finalReport ? "completed" : "awaiting_review",
          };
        }
        return { ...s, status: "error", error: "Connection closed" };
      });
    };

    return () => {
      es.close();
    };
  }, [query, threadId]);

  // If opening an existing thread without ?q= query param, load state from backend
  useEffect(() => {
    if (query) return;
    api
      .getThread(threadId)
      .then((r) => {
        const v = (r.values || {}) as Record<string, unknown>;
        const reviewStatus = (v.review_status as string) || "pending";
        const draft = (v.draft_report as string) || "";
        const final = (v.final_report as string) || "";

        let status: StreamState["status"] = "idle";
        if (final || reviewStatus === "approved" || reviewStatus === "edited") {
          status = "completed";
        } else if (draft) {
          status = "awaiting_review";
        }

        setState({
          status,
          nodes: [],
          sources: (v.retrieved_sources as Source[]) || [],
          draftReport: draft,
          finalReport: final || (status === "completed" ? draft : ""),
          query: (v.query as string) || "",
          error: "",
          subQuestions: (v.sub_questions as string[]) || [],
        });
      })
      .catch(() => {
        setState((s) => ({ ...s, status: "error", error: "Thread not found or unavailable." }));
      });
  }, [threadId, query]);

  async function handleReview(decision: "approve" | "edit" | "reject") {
    setSubmittingReview(true);
    const editedText = decision === "edit" ? editText : undefined;
    const fb = decision === "reject" ? feedback : undefined;

    try {
      await api.resumeAgent(threadId, decision, editedText, fb);

      if (decision === "reject") {
        setIsRejecting(false);
        setFeedback("");
        setState((s) => ({
          ...s,
          status: "streaming",
          nodes: [],
          draftReport: "",
          error: "",
        }));

        // Reconnect SSE stream after rejection loop
        const url = api.streamUrl(threadId, state.query);
        const token = getToken();
        const esUrl = token ? `${url}&token=${token}` : url;
        const es = new EventSource(esUrl);
        eventSourceRef.current = es;

        es.addEventListener("node", (e: MessageEvent) => {
          try {
            const data: NodeEvent = JSON.parse(e.data);
            setState((s) => ({
              ...s,
              nodes: [...s.nodes, data],
              sources:
                data.node === "retriever" && Array.isArray(data.sources)
                  ? (data.sources as Source[])
                  : s.sources,
              draftReport:
                typeof data.draft_report === "string" && data.draft_report
                  ? data.draft_report
                  : s.draftReport,
            }));
          } catch {}
        });

        es.addEventListener("status", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setState((s) => ({
              ...s,
              status: data.status === "awaiting_review" ? "awaiting_review" : s.status,
              draftReport: data.draft_report || s.draftReport,
            }));
          } catch {}
        });

        es.addEventListener("done", () => es.close());
        es.onerror = () => es.close();
      } else {
        setIsEditing(false);
        const final = decision === "edit" ? editText : state.draftReport;
        setState((s) => ({
          ...s,
          status: "completed",
          finalReport: final,
        }));
      }
    } catch {
      setState((s) => ({ ...s, error: "Failed to submit review decision. Please retry." }));
    } finally {
      setSubmittingReview(false);
    }
  }

  function handleDownloadMarkdown() {
    const report = state.finalReport || state.draftReport;
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${threadId.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    const report = state.finalReport || state.draftReport;
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brown/10 pb-6">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand block mb-1">
              Research Thread
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-brown truncate leading-tight">
              {state.query || "Researching Inquiry"}
            </h1>
            <p className="text-xs text-brown-lighter font-mono mt-1">ID: {threadId}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {state.status === "completed" && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-cream-dark hover:bg-brown/5 border border-brown/10 rounded-full text-xs font-semibold text-brown transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-brown-lighter" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  {copied ? "Copied!" : "Copy Report"}
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="px-4 py-2 bg-brand text-cream hover:bg-brand-light rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export MD
                </button>
              </>
            )}

            <div
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                state.status === "completed"
                  ? "bg-brand/10 text-brand"
                  : state.status === "awaiting_review"
                  ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                  : state.status === "streaming"
                  ? "bg-brand/10 text-brand"
                  : "bg-brown/5 text-brown-lighter"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  state.status === "completed"
                    ? "bg-brand"
                    : state.status === "awaiting_review"
                    ? "bg-amber-500"
                    : state.status === "streaming"
                    ? "bg-brand animate-ping"
                    : "bg-brown-lighter"
                }`}
              />
              {state.status === "awaiting_review"
                ? "Awaiting Review"
                : state.status === "completed"
                ? "Final Report"
                : state.status === "streaming"
                ? "Researching"
                : "Idle"}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {state.error && !state.draftReport && !state.finalReport && (
          <div className="p-5 bg-red-50 rounded-2xl border border-red-200 text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{state.error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Live Streaming State / Active Timeline */}
            {state.status === "streaming" && (
              <div className="p-6 bg-cream-dark rounded-2xl border border-brand/20 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-brand animate-pulse" />
                    <span className="font-serif text-lg font-bold text-brown">Autonomous Agent at Work</span>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">Live Progress</span>
                </div>
                <p className="text-sm text-brown-light leading-relaxed">
                  The agent is decomposing your question, searching knowledge bases and the live web, evaluating source coverage, and synthesizing a cited report.
                </p>
              </div>
            )}

            {/* Timeline Progress */}
            {state.nodes.length > 0 && (
              <div className="bg-cream-dark rounded-2xl border border-brown/5 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-brown/5 pb-3">
                  <h3 className="text-[11px] uppercase tracking-[0.3em] font-bold text-brown-lighter">
                    Agent Execution Steps
                  </h3>
                  <span className="text-xs text-brown-lighter font-mono">{state.nodes.length} events</span>
                </div>

                <div className="space-y-3">
                  {state.nodes.map((n, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 p-2.5 rounded-xl hover:bg-white/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            n.status === "done"
                              ? "bg-brand"
                              : n.status === "awaiting_review"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-brown/20"
                          }`}
                        />
                        <span className="text-sm font-semibold text-brown">{NODE_LABELS[n.node] || n.node}</span>
                        <span className="text-xs text-brown-lighter font-mono">({n.status})</span>
                      </div>

                      <div className="text-xs text-brown-lighter text-right shrink-0">
                        {n.node === "critique" && (
                          <span
                            className={`font-semibold px-2 py-0.5 rounded-full ${
                              n.sufficient ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {n.sufficient ? "Sufficient" : "Refining Questions"}
                          </span>
                        )}
                        {n.node === "retriever" && <span>{String(n.source_count || 0)} sources gathered</span>}
                        {n.node === "writer" && <span>{String(n.draft_length || 0)} characters drafted</span>}
                        {n.node === "finalize" && <span className="text-brand font-semibold">Memory Stored</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {state.subQuestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-brown/5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brown-lighter mb-2">Planned Sub-Questions</h4>
                    <ul className="space-y-1.5 pl-4 text-xs text-brown-light list-disc">
                      {state.subQuestions.map((sq, idx) => (
                        <li key={idx} className="leading-relaxed">{sq}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Human-In-The-Loop Draft Review Panel */}
            {state.status === "awaiting_review" && (state.draftReport || state.finalReport) && (
              <div className="bg-cream-dark rounded-3xl border-2 border-amber-300 p-8 shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200 pb-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                      Human-in-the-Loop Review
                    </div>
                    <h2 className="font-serif text-2xl md:text-3xl font-bold text-brown">Draft Research Report</h2>
                    <p className="text-xs text-brown-lighter mt-1">
                      Review the autonomous synthesis below. You can approve it as-is, edit the text, or reject with instructions.
                    </p>
                  </div>
                </div>

                {/* Draft Content Rendering */}
                {!isEditing ? (
                  <div className="bg-white p-8 rounded-2xl border border-brown/10 shadow-inner max-h-[600px] overflow-y-auto">
                    <MarkdownRenderer content={state.draftReport || state.finalReport} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-brown">Edit Markdown Content</label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={18}
                      className="w-full bg-white border-2 border-brand/30 rounded-2xl p-5 text-sm font-mono text-brown leading-relaxed resize-y focus:border-brand shadow-inner"
                      placeholder="Modify the draft markdown..."
                    />
                  </div>
                )}

                {/* Rejection Feedback Box */}
                {isRejecting && (
                  <div className="space-y-3 bg-red-50/50 p-6 rounded-2xl border border-red-200">
                    <label className="text-xs font-bold uppercase tracking-wider text-red-800">
                      Revision Instructions for Agent
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      placeholder="e.g. Please search for more recent 2025 statistics or focus more on voice assistants..."
                      className="w-full bg-white border border-red-200 rounded-xl p-4 text-sm text-brown resize-none focus:border-red-500"
                    />
                  </div>
                )}

                {/* Review Action Buttons */}
                <div className="flex flex-wrap gap-4 pt-2">
                  {!isEditing && !isRejecting ? (
                    <>
                      <button
                        onClick={() => handleReview("approve")}
                        disabled={submittingReview}
                        className="flex-1 bg-brand text-cream py-4 px-8 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg hover:bg-brand-light flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {submittingReview ? "Finalizing..." : "Approve & Finalize"}
                      </button>

                      <button
                        onClick={() => {
                          setEditText(state.draftReport || state.finalReport);
                          setIsEditing(true);
                        }}
                        disabled={submittingReview}
                        className="px-8 py-4 bg-white border-2 border-brand text-brand hover:bg-brand/5 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-colors shadow-sm"
                      >
                        Edit Draft
                      </button>

                      <button
                        onClick={() => setIsRejecting(true)}
                        disabled={submittingReview}
                        className="px-6 py-4 bg-transparent border border-brown/20 text-brown-lighter hover:text-red-700 hover:border-red-300 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-colors"
                      >
                        Request Revision
                      </button>
                    </>
                  ) : isEditing ? (
                    <>
                      <button
                        onClick={() => handleReview("edit")}
                        disabled={submittingReview || !editText.trim()}
                        className="flex-1 bg-brand text-cream py-4 px-8 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform shadow-lg hover:bg-brand-light"
                      >
                        {submittingReview ? "Saving..." : "Save & Approve Edited Report"}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        disabled={submittingReview}
                        className="px-6 py-4 bg-white border border-brown/20 text-brown-lighter hover:bg-brown/5 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReview("reject")}
                        disabled={submittingReview}
                        className="flex-1 bg-red-700 text-white py-4 px-8 rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-red-800 transition-colors shadow-lg"
                      >
                        {submittingReview ? "Sending Feedback..." : "Submit Revision Request"}
                      </button>
                      <button
                        onClick={() => setIsRejecting(false)}
                        disabled={submittingReview}
                        className="px-6 py-4 bg-white border border-brown/20 text-brown-lighter hover:bg-brown/5 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Completed Final Report */}
            {state.status === "completed" && (state.finalReport || state.draftReport) && (
              <div className="bg-white rounded-3xl border border-brown/10 p-8 md:p-12 shadow-xl space-y-8">
                <div className="flex items-center justify-between border-b border-brown/10 pb-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand block mb-1">
                      Synthesized & Verified
                    </span>
                    <h2 className="font-serif text-3xl font-bold text-brown">Research Report</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold uppercase tracking-wider">
                      ✓ Approved
                    </span>
                  </div>
                </div>

                <div className="report-container">
                  <MarkdownRenderer content={state.finalReport || state.draftReport} />
                </div>
              </div>
            )}

            {/* Initializing Loading State */}
            {state.status === "idle" && (
              <div className="text-center py-24 bg-cream-dark rounded-2xl border border-brown/5">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-serif text-lg text-brown font-semibold">Connecting to Research Engine</p>
                <p className="text-xs text-brown-lighter mt-1">Preparing multi-agent graph...</p>
              </div>
            )}
          </div>

          {/* Right Sidebar: Sources Gathered */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-cream-dark rounded-2xl border border-brown/5 p-6 shadow-sm sticky top-24">
              <div className="flex items-center justify-between mb-4 border-b border-brown/5 pb-3">
                <h3 className="text-[11px] uppercase tracking-[0.3em] font-bold text-brown-lighter">
                  Sources Gathered
                </h3>
                <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full">
                  {state.sources.length}
                </span>
              </div>

              {state.sources.length === 0 ? (
                <div className="text-center py-10 text-brown-lighter/60">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <p className="text-xs">Live citations will populate here as retrieval completes.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {state.sources.map((s, i) => (
                    <div
                      key={i}
                      className="p-4 bg-white rounded-xl border border-brown/10 shadow-xs hover:border-brand/30 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            s.origin === "rag"
                              ? "bg-brand/10 text-brand"
                              : "bg-blue-50 text-blue-700 border border-blue-100"
                          }`}
                        >
                          {s.origin}
                        </span>
                        {s.source.startsWith("http") ? (
                          <a
                            href={s.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-brand hover:underline font-mono truncate max-w-[180px] inline-flex items-center gap-1"
                          >
                            {s.source.replace(/^https?:\/\//, "")}
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-[11px] text-brown-lighter font-mono truncate max-w-[180px]">
                            {s.source}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brown-light leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                        {s.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
