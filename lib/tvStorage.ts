type TVSession = {
  code: string;
  createdAt: number;
  connected: boolean;
  payload?: any;
};

declare global {
  // eslint-disable-next-line no-var
  var __tvSessions: Map<string, TVSession> | undefined;
}

const store = global.__tvSessions || new Map<string, TVSession>();
global.__tvSessions = store;

export const tvSessions = store;

export function generateTVCode() {
  let code = "";
  do {
    code = String(Math.floor(10000000 + Math.random() * 90000000));
  } while (tvSessions.has(code));
  return code;
}

export function cleanupOldTVSessions(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();

  for (const [code, session] of tvSessions.entries()) {
    if (now - session.createdAt > maxAgeMs) {
      tvSessions.delete(code);
    }
  }
}
