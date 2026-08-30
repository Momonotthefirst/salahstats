// Couche de notifications : natif (Capacitor) si disponible, sinon Web Notification.
import { PRAYERS, timesFor, formatTime, type PrayerName } from "@/lib/prayer";

const ASK_DELAY_MS = 10 * 60 * 1000;

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function localNotifications() {
  const mod = await import("@capacitor/local-notifications");
  return mod.LocalNotifications;
}

/** Demande la permission (native ou web). Retourne "granted" / "denied" / "default". */
export async function requestNotificationPermission(): Promise<string> {
  if (isNative()) {
    try {
      const LN = await localNotifications();
      const res = await LN.requestPermissions();
      return res.display === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }
  if (typeof Notification === "undefined") return "denied";
  return await Notification.requestPermission();
}

export async function currentPermission(): Promise<string> {
  if (isNative()) {
    try {
      const LN = await localNotifications();
      const res = await LN.checkPermissions();
      return res.display === "granted" ? "granted" : "default";
    } catch {
      return "default";
    }
  }
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission;
}

/** Notification immédiate (utilisée surtout sur le web). */
export function notifyNow(title: string, body: string) {
  if (isNative()) {
    void (async () => {
      try {
        const LN = await localNotifications();
        await LN.schedule({
          notifications: [{ id: Math.floor(Math.random() * 100000), title, body }],
        });
      } catch {
        /* ignore */
      }
    })();
    return;
  }
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  } catch {
    /* ignore */
  }
}

const idFor = (dayOffset: number, prayer: PrayerName, kind: 0 | 1) =>
  dayOffset * 100 + PRAYERS.findIndex((p) => p.key === prayer) * 10 + kind;

/**
 * Planifie sur l'appareil (7 jours) : une notif à l'heure de la prière
 * et une notif "Tu as prié ?" 10 minutes plus tard.
 */
export async function scheduleNativePrayerNotifications(days = 7) {
  if (!isNative()) return;
  try {
    const LN = await localNotifications();
    const perm = await LN.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LN.requestPermissions();
      if (req.display !== "granted") return;
    }

    const pending = await LN.getPending();
    if (pending.notifications.length) {
      await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    const now = Date.now();
    const notifications = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(now + d * 24 * 60 * 60 * 1000);
      const times = timesFor(date);
      for (const p of PRAYERS) {
        const t = times[p.key].getTime();
        if (t > now) {
          notifications.push({
            id: idFor(d, p.key, 0),
            title: `C'est l'heure de ${p.label} 🕌`,
            body: `${p.label} à ${formatTime(times[p.key])} — Laval`,
            schedule: { at: new Date(t) },
          });
        }
        const ask = t + ASK_DELAY_MS;
        if (ask > now) {
          notifications.push({
            id: idFor(d, p.key, 1),
            title: "Tu as prié ?",
            body: `As-tu accompli ${p.label} ? Réponds oui ou non dans l'app.`,
            schedule: { at: new Date(ask) },
          });
        }
      }
    }
    if (notifications.length) await LN.schedule({ notifications });
  } catch {
    /* ignore */
  }
}
