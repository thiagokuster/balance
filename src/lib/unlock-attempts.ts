const KEY = "saldo-tentativas";

type AttemptState = { count: number; until: number };

function read(): AttemptState {
  if (typeof window === "undefined") return { count: 0, until: 0 };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Partial<AttemptState>;
    const count = typeof parsed.count === "number" ? parsed.count : 0;
    const until = typeof parsed.until === "number" ? parsed.until : 0;
    return { count, until };
  } catch {
    return { count: 0, until: 0 };
  }
}

export function unlockDelaySeconds() {
  return Math.max(0, Math.ceil((read().until - Date.now()) / 1000));
}

export function noteUnlockFailure() {
  const count = read().count + 1;
  const wait = Math.min(60, 2 ** (count - 1));
  localStorage.setItem(KEY, JSON.stringify({ count, until: Date.now() + wait * 1000 }));
  return wait;
}

export function clearUnlockFailures() {
  localStorage.removeItem(KEY);
}
