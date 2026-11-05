const KEY = "saldo-tentativas";

type AttemptState = { count: number; until: number };

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function read(): AttemptState {
  if (typeof window === "undefined") return { count: 0, until: 0 };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Partial<AttemptState>;
    return { count: Math.floor(finite(parsed.count)), until: finite(parsed.until) };
  } catch {
    return { count: 0, until: 0 };
  }
}

export function unlockDelaySeconds() {
  return Math.max(0, Math.ceil((read().until - Date.now()) / 1000));
}

export function noteUnlockFailure() {
  try {
    const count = read().count + 1;
    const wait = Math.min(60, 2 ** (count - 1));
    localStorage.setItem(KEY, JSON.stringify({ count, until: Date.now() + wait * 1000 }));
    return wait;
  } catch {
    return 0;
  }
}

export function clearUnlockFailures() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* the lock screen still has to say the password was wrong */
  }
}
