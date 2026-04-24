const BASE = '/api';

export async function streamChat(message, sessionId, callbacks) {
  const { onChunk, onToolUse, onDone, onError, onThinking, onSpecial } = callbacks;
  try {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      onError?.(d.detail || `HTTP ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          switch (data.type) {
            case 'thinking':    onThinking?.(); break;
            case 'tool_use':    onToolUse?.(data); break;
            case 'chunk':       onChunk?.(data.content); break;
            case 'captured_image':
            case 'generated_image': onSpecial?.(data); break;
            case 'done':        onDone?.(data); break;
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    onError?.(e.message || 'Connection failed');
  }
}

export async function uploadAndChat(message, sessionId, file) {
  const form = new FormData();
  form.append('message', message);
  form.append('session_id', sessionId);
  form.append('file', file);
  const res = await fetch(`${BASE}/chat/upload-and-chat`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Upload chat failed');
  return data;
}

export async function clearMemory(sessionId) {
  await fetch(`${BASE}/chat/clear`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/documents/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Upload failed');
  return data;
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents/list`);
  if (!res.ok) throw new Error('Failed to list docs');
  return res.json();
}

export async function deleteDocument(filename) {
  const res = await fetch(`${BASE}/documents/delete`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Delete failed');
  return data;
}

export async function getConfig() {
  try {
    const res = await fetch(`${BASE}/config/info`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function updateConfig(payload) {
  const res = await fetch(`${BASE}/config/update`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Update failed');
  return data;
}

export async function getTools() {
  try {
    const res = await fetch(`${BASE}/config/tools`);
    return res.ok ? res.json() : { tools: [] };
  } catch { return { tools: [] }; }
}

export async function checkHealth() {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false };
    const d = await res.json();
    return { online: true, ...d };
  } catch { return { online: false }; }
}

export function imageUrl(filename) {
  return `${BASE}/chat/image/${filename}`;
}
