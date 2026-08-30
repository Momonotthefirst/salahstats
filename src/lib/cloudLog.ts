import { supabase } from "@/integrations/supabase/client";
import { readLog, type Answer, type Log } from "./tracker";
import type { PrayerName } from "./prayer";

const MIGRATED_KEY = "salat-cloud-migrated-v1";

export async function fetchCloudLog(userId: string): Promise<Log> {
  const { data, error } = await supabase
    .from("prayer_logs")
    .select("day, prayer, answer")
    .eq("user_id", userId);
  if (error) throw error;
  const log: Log = {};
  for (const row of data ?? []) {
    log[row.day] = { ...(log[row.day] ?? {}), [row.prayer as PrayerName]: row.answer as Answer };
  }
  return log;
}

export async function saveCloudAnswer(
  userId: string,
  day: string,
  prayer: PrayerName,
  answer: Answer,
) {
  const { error } = await supabase
    .from("prayer_logs")
    .upsert(
      { user_id: userId, day, prayer, answer, updated_at: new Date().toISOString() },
      { onConflict: "user_id,day,prayer" },
    );
  if (error) throw error;
}

/** Envoie les prières déjà enregistrées localement vers le compte, une seule fois. */
export async function migrateLocalLog(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_KEY)) return;
  const local = readLog();
  const rows = Object.entries(local).flatMap(([day, prayers]) =>
    Object.entries(prayers ?? {}).map(([prayer, answer]) => ({
      user_id: userId,
      day,
      prayer,
      answer: answer as Answer,
    })),
  );
  if (rows.length) {
    await supabase.from("prayer_logs").upsert(rows, { onConflict: "user_id,day,prayer" });
  }
  localStorage.setItem(MIGRATED_KEY, "1");
}
