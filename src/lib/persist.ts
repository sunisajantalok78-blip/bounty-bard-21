// Tiny localStorage persistence hook + helpers.
// Used so the operator (and their partner) can close the tab and
// come back later with all profile links, plans, and counters intact.

import { useEffect, useRef, useState } from "react";

const PREFIX = "bountyhunter:v1:";

export function loadPersisted<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function savePersisted<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / serialization issues are non-fatal */
  }
}

export function clearPersisted(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

/** State that is automatically persisted to localStorage under `key`. */
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => loadPersisted(key, initial));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    savePersisted(key, state);
  }, [key, state]);
  return [state, setState] as const;
}
