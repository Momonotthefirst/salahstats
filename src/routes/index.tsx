import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCloudLog, migrateLocalLog, saveCloudAnswer } from "@/lib/cloudLog";
import {
  PRAYERS,
  countdown,
  dayKey,
  formatTime,
  nextPrayer,
  timesFor,
  type PrayerName,
} from "@/lib/prayer";
import {
  markNotified,
  readLog,
  readNotified,
  weekStats,
  writeAnswer,
  type Log,
} from "@/lib/tracker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Salat Laval — Horaires de prière et suivi" },
      {
        name: "description",
        content:
          "Horaires des 5 prières à Laval (Québec), rappels à l'heure, question de suivi 10 minutes après et statistiques hebdomadaires des prières manquées.",
      },
      { property: "og:title", content: "Salat Laval — Horaires de prière et suivi" },
      {
        property: "og:description",
        content:
          "Rappels de prière et statistiques hebdomadaires pour les 5 prières, fuseau horaire de Laval, Canada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ASK_DELAY_MS = 10 * 60 * 1000;
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;

const REMINDERS = [
  "Souviens-toi de dire Bismillah avant chaque action.",
  "La prière est le pilier de la religion, ne la néglige pas.",
  "Un sourire envers ton frère est une sadaqa.",
  "Dis SubhanAllah, Alhamdulillah, Allahu Akbar 33 fois après chaque prière.",
  "Le paradis est sous les pieds des mères.",
  "Cherche le savoir, même jusqu'en Chine.",
  "La patience est la clé du soulagement.",
  "Fais du dhikr, cela apaise le cœur.",
  "Sois bon avec tes voisins, c'est un devoir islamique.",
  "Le meilleur parmi vous est celui qui est le meilleur envers sa famille.",
];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useRotatingReminder(intervalMs = REMINDER_INTERVAL_MS) {
  const [index, setIndex] = useState(() => {
    const start = Math.floor(Date.now() / intervalMs);
    return start % REMINDERS.length;
  });
  useEffect(() => {
    const update = () => {
      const next = Math.floor(Date.now() / intervalMs) % REMINDERS.length;
      setIndex(next);
    };
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [intervalMs]);
  return REMINDERS[index];
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  } catch {
    /* ignore */
  }
}

function Index() {
  const navigate = useNavigate();
  const now = useNow();
  const [log, setLog] = useState<Log>({});
  const [permission, setPermission] = useState<string>("default");
  const [tick, setTick] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);

    const load = async (uid: string) => {
      await migrateLocalLog(uid);
      try {
        setLog(await fetchCloudLog(uid));
      } catch {
        setLog(readLog());
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setChecking(false);
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);
      void load(session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        setUserId(null);
        navigate({ to: "/auth" });
        return;
      }
      setUserId(session.user.id);
      setEmail(session.user.email ?? null);
      void load(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const today = dayKey(now);
  const times = useMemo(() => timesFor(now), [today]);
  const next = useMemo(() => nextPrayer(now), [now.getMinutes(), today]);

  // Rappels : à l'heure de la prière, puis 10 min après avec la question.
  useEffect(() => {
    const notified = readNotified();
    for (const p of PRAYERS) {
      const t = times[p.key].getTime();
      const idTime = `${today}-${p.key}-time`;
      const idAsk = `${today}-${p.key}-ask`;
      if (now.getTime() >= t && !notified[idTime]) {
        markNotified(idTime);
        notify(`C'est l'heure de ${p.label} 🕌`, `${p.label} à ${formatTime(times[p.key])} — Laval`);
      }
      if (
        now.getTime() >= t + ASK_DELAY_MS &&
        !notified[idAsk] &&
        !log[today]?.[p.key]
      ) {
        markNotified(idAsk);
        notify("Tu as prié ?", `As-tu accompli ${p.label} ? Réponds oui ou non dans l'app.`);
        setTick((x) => x + 1);
      }
    }
  }, [Math.floor(now.getTime() / 15000), today]);

  const pending = PRAYERS.filter(
    (p) => now.getTime() >= times[p.key].getTime() + ASK_DELAY_MS && !log[today]?.[p.key],
  );

  const stats = useMemo(() => weekStats(log, now), [log, today, tick]);

  const answer = (p: PrayerName, a: "yes" | "no") => setLog({ ...writeAnswer(today, p, a) });

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const res = await Notification.requestPermission();
    setPermission(res);
  };

  const inIframe = typeof window !== "undefined" && window.top !== window.self;

  const reminder = useRotatingReminder();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-10">
        <div className="mb-6 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-center">
          <p className="text-xs uppercase tracking-widest text-accent">Rappel islamique</p>
          <p className="mt-1 text-sm font-medium text-card-foreground">{reminder}</p>
        </div>

        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Laval · Québec</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-foreground">
            Mes cinq prières
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("fr-CA", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "America/Toronto",
            }).format(now)}
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">Prochaine prière</p>
          <h2 className="mt-1 font-serif text-3xl text-accent">
            {PRAYERS.find((p) => p.key === next.key)?.label}
          </h2>
          <p className="mt-1 text-lg text-card-foreground">{formatTime(next.time)}</p>
          <p className="mt-3 font-mono text-4xl tabular-nums text-foreground">
            {countdown(next.time.getTime() - now.getTime())}
          </p>
        </section>

        {permission !== "granted" && (
          <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
            <p className="text-card-foreground">
              Active les notifications pour recevoir l'appel à l'heure et la question 10 minutes
              après.
            </p>
            {inIframe ? (
              <p className="mt-2 text-muted-foreground">
                Ouvre l'application dans un onglet séparé pour autoriser les notifications.
              </p>
            ) : (
              <button
                onClick={askPermission}
                className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
              >
                Activer les notifications
              </button>
            )}
          </div>
        )}

        {pending.length > 0 && (
          <section className="mt-8">
            <h3 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
              Tu as prié ?
            </h3>
            <div className="space-y-3">
              {pending.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(times[p.key])}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => answer(p.key, "yes")}
                      className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                    >
                      Oui
                    </button>
                    <button
                      onClick={() => answer(p.key, "no")}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
                    >
                      Non
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h3 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
            Horaires du jour
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {PRAYERS.map((p) => {
              const a = log[today]?.[p.key];
              const isNext = next.key === p.key;
              return (
                <li
                  key={p.key}
                  className={`flex items-center justify-between px-5 py-4 ${isNext ? "bg-secondary" : ""}`}
                >
                  <div>
                    <p className="font-medium text-card-foreground">
                      {p.label} <span className="ml-2 text-muted-foreground">{p.arabic}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(times[p.key])}</p>
                  </div>
                  {a ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${a === "yes" ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"}`}
                    >
                      {a === "yes" ? "Priée" : "Manquée"}
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => answer(p.key, "yes")}
                        className="rounded-full border border-accent/50 px-3 py-1 text-xs text-accent transition hover:bg-accent/10"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => answer(p.key, "no")}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:bg-secondary"
                      >
                        Non
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-10">
          <h3 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
            Statistiques de la semaine
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Priées" value={stats.done} tone="accent" />
            <StatCard label="Manquées" value={stats.missed} tone="destructive" />
            <StatCard label="Assiduité" value={`${stats.rate}%`} tone="default" />
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-end justify-between gap-2">
              {stats.days.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full max-w-9 flex-col justify-end overflow-hidden rounded-md bg-secondary">
                    <div
                      className="w-full bg-destructive/70"
                      style={{ height: `${(d.missed / 5) * 100}%` }}
                    />
                    <div
                      className="w-full bg-accent"
                      style={{ height: `${(d.done / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-CA", {
                      weekday: "short",
                      timeZone: "America/Toronto",
                    }).format(new Date(`${d.day}T12:00:00`))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {stats.perPrayer.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <span className="text-card-foreground">{p.label}</span>
                <span className="text-muted-foreground">
                  <span className="text-accent">{p.done} priées</span> ·{" "}
                  <span className="text-destructive">{p.missed} manquées</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Horaires calculés pour Laval (45.61°N, 73.71°O) — méthode ISNA, fuseau America/Toronto.
          Garde l'application ouverte dans un onglet pour recevoir les rappels.
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "accent" | "destructive" | "default";
}) {
  const color =
    tone === "accent" ? "text-accent" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className={`font-serif text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
