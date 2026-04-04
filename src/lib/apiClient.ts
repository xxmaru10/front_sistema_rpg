import { ActionEvent } from "@/types/domain";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface SessionLoadResult {
    events: ActionEvent[];
    snapshot: { state: any; upToSeq: number } | null;
}

export interface AppendResult {
    id: string;
    seq: number;
    createdAt: string;
}

export interface SessionData {
    id: string;
    name: string;
    gmUserId: string;
}

export interface SessionJoinInfo {
    gmCode: string;
    playerCode: string;
    characters: any[];
}

export async function loadSessionEvents(sessionId: string): Promise<SessionLoadResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000); // 12s timeout for history
    try {
        const res = await fetch(`${API_BASE}/api/events/${sessionId}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`[apiClient] loadSessionEvents falhou: ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export async function appendEvent(
    sessionId: string,
    event: ActionEvent,
): Promise<AppendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout for appends
    try {
        const res = await fetch(`${API_BASE}/api/events/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`[apiClient] appendEvent falhou: ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchGlobalBestiary(): Promise<ActionEvent[]> {
    const res = await fetch(`${API_BASE}/api/bestiary`, {
        signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`[apiClient] fetchGlobalBestiary falhou: ${res.status}`);
    const data = await res.json();
    return data.events as ActionEvent[];
}

export async function clearSessionEvents(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/events/${sessionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`[apiClient] clearSession falhou: ${res.status}`);
    }
}

export async function fetchSessions(): Promise<SessionData[]> {
    const res = await fetch(`${API_BASE}/api/sessions`, {
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`[apiClient] fetchSessions falhou: ${res.status}`);
    return await res.json();
}

export async function createSession(session: SessionData): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok && res.status !== 201) {
        throw new Error(`[apiClient] createSession falhou: ${res.status}`);
    }
}

export async function fetchSessionJoinInfo(sessionId: string): Promise<SessionJoinInfo> {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/join-info`, {
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`[apiClient] fetchSessionJoinInfo falhou: ${res.status}`);
    return await res.json();
}

export async function updateSnapshot(sessionId: string, upToSeq: number, state: any): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/snapshot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upToSeq, state }),
        signal: AbortSignal.timeout(15000) // Snapshots can be slow/large
    });
    if (!res.ok && res.status !== 204) {
        throw new Error(`[apiClient] updateSnapshot falhou: ${res.status}`);
    }
}

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const res = await fetch(`${API_BASE}/api/storage/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`presign failed: ${res.status}`);
  return res.json();
}

export async function uploadToS3(
  uploadUrl: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 
      'Content-Type': contentType,
    },
    body: file,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}
