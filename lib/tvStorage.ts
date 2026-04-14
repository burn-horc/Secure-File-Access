type TVSession = {
  code: string;
  createdAt: number;
  connected: boolean;
  payload: any;
};

export const tvSessions = new Map<string, TVSession>();

export function generateTVCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export function cleanupOldTVSessions() {
  const now = Date.now();

  for (const [code, session] of tvSessions.entries()) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      tvSessions.delete(code);
    }
  }
}
