import { CalculationMethod, Coordinates, PrayerTimes } from "adhan";

export const LAVAL = new Coordinates(45.6066, -73.7124);
export const TIMEZONE = "America/Toronto";

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYERS: { key: PrayerName; label: string; arabic: string }[] = [
  { key: "fajr", label: "Fajr", arabic: "الفجر" },
  { key: "dhuhr", label: "Dhuhr", arabic: "الظهر" },
  { key: "asr", label: "Asr", arabic: "العصر" },
  { key: "maghrib", label: "Maghrib", arabic: "المغرب" },
  { key: "isha", label: "Isha", arabic: "العشاء" },
];

function params() {
  const p = CalculationMethod.NorthAmerica();
  return p;
}

export function timesFor(date: Date): Record<PrayerName, Date> {
  const t = new PrayerTimes(LAVAL, date, params());
  return {
    fajr: t.fajr,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  };
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
}

/** YYYY-MM-DD in Laval local time */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).format(d);
}

export function nextPrayer(now: Date): { key: PrayerName; time: Date } {
  const today = timesFor(now);
  for (const p of PRAYERS) {
    if (today[p.key].getTime() > now.getTime()) return { key: p.key, time: today[p.key] };
  }
  const tomorrow = timesFor(new Date(now.getTime() + 86400000));
  return { key: "fajr", time: tomorrow.fajr };
}

export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
