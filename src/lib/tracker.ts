import { dayKey, PRAYERS, type PrayerName, timesFor } from "./prayer";

export type Answer = "yes" | "no";
export type Log = Record<string, Partial<Record<PrayerName, Answer>>>;

const LOG_KEY = "salat-log-v1";
const NOTIF_KEY = "salat-notified-v1";

export function readLog(): Log {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}") as Log;
  } catch {
    return {};
  }
}

export function writeAnswer(day: string, prayer: PrayerName, answer: Answer): Log {
  const log = readLog();
  log[day] = { ...(log[day] ?? {}), [prayer]: answer };
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  return log;
}

export function readNotified(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

export function markNotified(id: string) {
  const n = readNotified();
  n[id] = true;
  localStorage.setItem(NOTIF_KEY, JSON.stringify(n));
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now - i * 86400000)));
  return out;
}

export type WeekStats = {
  days: { day: string; done: number; missed: number; pending: number }[];
  done: number;
  missed: number;
  pending: number;
  total: number;
  rate: number;
  perPrayer: { key: PrayerName; label: string; done: number; missed: number }[];
};

export function weekStats(log: Log, now = new Date()): WeekStats {
  const days = lastNDays(7);
  const today = dayKey(now);
  const perPrayer = PRAYERS.map((p) => ({ key: p.key, label: p.label, done: 0, missed: 0 }));
  let done = 0;
  let missed = 0;
  let pending = 0;

  const rows = days.map((day) => {
    let d = 0;
    let m = 0;
    let pen = 0;
    for (const p of PRAYERS) {
      const a = log[day]?.[p.key];
      const isFuture =
        day === today && timesFor(now)[p.key].getTime() > now.getTime();
      if (a === "yes") {
        d++;
        perPrayer.find((x) => x.key === p.key)!.done++;
      } else if (a === "no") {
        m++;
        perPrayer.find((x) => x.key === p.key)!.missed++;
      } else if (isFuture || day > today) {
        pen++;
      } else {
        m++;
        perPrayer.find((x) => x.key === p.key)!.missed++;
      }
    }
    done += d;
    missed += m;
    pending += pen;
    return { day, done: d, missed: m, pending: pen };
  });

  const total = done + missed;
  return {
    days: rows,
    done,
    missed,
    pending,
    total,
    rate: total ? Math.round((done / total) * 100) : 0,
    perPrayer,
  };
}
