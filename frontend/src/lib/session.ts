const APP_SESSION_STORAGE_KEY = "futurespend_app_session_id";

function generateSessionId(prefix: string): string {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

export function getStoredSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(APP_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = generateSessionId("app");
  window.localStorage.setItem(APP_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

export function createChatSessionId(scope: string): string {
  return generateSessionId(scope);
}
