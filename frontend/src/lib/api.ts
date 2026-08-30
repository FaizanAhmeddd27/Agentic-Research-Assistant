const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const TOKEN_KEY = "derve_token";
const COOKIE_KEY = "derve_session";

function setSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event("auth:change"));
  }
  setSessionCookie();
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("auth:change"));
  }
  clearSessionCookie();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }

  return (await res.json()) as T;
}

// ---------- Types ----------

export interface User { id: string; email: string; name: string; }

export interface Thread {
  thread_id: string;
  query: string;
  status: "in_progress" | "awaiting_review" | "completed";
}

export interface ThreadState {
  thread_id: string;
  values: Record<string, unknown>;
}

export interface Document {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string | null;
}

export interface Settings {
  llm_provider: string;
  web_search_enabled: boolean;
}

export interface Report {
  id: string;
  thread_id: string;
  content_markdown: string;
  status: string;
  version: number;
  created_at: string | null;
}

export interface MemoryEntry {
  id?: string;
  key: string;
  value?: string;
  summary?: string;
  category?: string;
  created_at?: string;
}

export interface Source {
  id: string;
  text: string;
  score: number;
  source: string;
  origin: "rag" | "web";
}

// ---------- API ----------

export const api = {
  // Auth
  signup: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/signup", {
      method: "POST", body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  logout: () => request<{ logged_out: boolean }>("/api/auth/logout", { method: "POST" }),

  // Threads
  listThreads: () => request<{ threads: Thread[]; count: number }>("/api/threads/"),
  getThread: (id: string) => request<ThreadState>(`/api/threads/${id}`),

  // Agent
  runAgent: (query: string, threadId?: string) =>
    request<Record<string, unknown>>("/api/agent/run", {
      method: "POST", body: JSON.stringify({ query, thread_id: threadId }),
    }),
  resumeAgent: (threadId: string, decision: string, editedText?: string, feedback?: string) =>
    request<Record<string, unknown>>("/api/agent/resume", {
      method: "POST", body: JSON.stringify({ thread_id: threadId, decision, edited_text: editedText, feedback }),
    }),

  // Streaming
  streamUrl: (threadId: string, query: string) =>
    `${BACKEND_URL}/api/stream/${threadId}?query=${encodeURIComponent(query)}`,

  // Documents
  listDocuments: () => request<{ documents: Document[]; count: number }>("/api/documents/"),
  uploadDocument: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = getToken();
    const res = await fetch(`${BACKEND_URL}/api/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.detail ?? res.statusText);
    }
    return (await res.json()) as { id: string; filename: string; chunk_count: number };
  },
  deleteDocument: (id: string) =>
    request<{ deleted: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),

  // Settings
  getSettings: () => request<Settings>("/api/settings/"),
  updateSettings: (s: Partial<Settings>) =>
    request<Settings>("/api/settings/", { method: "PUT", body: JSON.stringify(s) }),

  // Reports
  getReport: (threadId: string) => request<Report>(`/api/reports/${threadId}`),
  exportReportUrl: (threadId: string) => {
    const token = getToken();
    return `${BACKEND_URL}/api/reports/${threadId}/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  // Memory
  listMemory: () => request<{ user_id: string; memories: MemoryEntry[]; count: number }>("/api/memory/"),
  deleteMemory: (key: string) =>
    request<{ deleted: boolean }>(`/api/memory/${key}`, { method: "DELETE" }),
};
