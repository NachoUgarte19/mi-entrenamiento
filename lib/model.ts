import { z } from "zod";

export const categorySchema = z.enum(["pull", "push", "full", "class"]);
export type Category = z.infer<typeof categorySchema>;
export const labels: Record<Category, string> = {
  pull: "Tirón",
  push: "Empuje",
  full: "Full body",
  class: "Clase",
};
export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  group: z.string().max(80),
  unit: z.enum(["reps", "seconds", "minutes", "check"]),
  load: z.enum(["none", "total", "each", "added", "assistance"]),
  notes: z.string().max(4000),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export const itemSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  block: z.string().max(100),
  sets: z.number().int().min(1).max(30),
  target: z.string().max(120),
  rest: z.number().int().min(0).max(1800),
  optional: z.boolean(),
  notes: z.string().max(4000),
  circuit: z.string().max(100).default(""),
});
export type RoutineItem = z.infer<typeof itemSchema>;
export const routineSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  category: categorySchema,
  items: z.array(itemSchema).min(1).max(100),
  notes: z.string().max(4000),
});
export type Routine = z.infer<typeof routineSchema>;
export const planSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  routineId: z.string().nullable(),
  title: z.string().max(120),
  category: categorySchema,
});
export type Plan = z.infer<typeof planSchema>;
export const setSchema = z.object({
  id: z.string(),
  value: z.number().min(0).max(100000).nullable(),
  weight: z.number().min(0).max(2000).nullable(),
  rir: z.number().int().min(0).max(20).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  done: z.boolean(),
});
export type TrainingSet = z.infer<typeof setSchema>;
export const sessionItemSchema = z.object({
  id: z.string(),
  exercise: exerciseSchema,
  block: z.string(),
  target: z.string(),
  rest: z.number(),
  optional: z.boolean(),
  notes: z.string(),
  circuit: z.string(),
  skipped: z.boolean(),
  sets: z.array(setSchema),
});
export type SessionItem = z.infer<typeof sessionItemSchema>;
export const sessionSchema = z.object({
  id: z.string(),
  planId: z.string().nullable(),
  routineId: z.string().nullable(),
  title: z.string(),
  category: categorySchema,
  date: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  status: z.enum(["active", "completed"]),
  items: z.array(sessionItemSchema),
  notes: z.string(),
});
export type TrainingSession = z.infer<typeof sessionSchema>;
export const cardioActivities = {
  run: "Correr", treadmill: "Cinta", walk: "Caminata", bike: "Bicicleta",
  indoorBike: "Bici fija", elliptical: "Elíptica", rowing: "Remo", swim: "Natación", other: "Otro",
} as const;
export const cardioSchema = z.object({
  id: z.string(),
  activity: z.enum(["run", "treadmill", "walk", "bike", "indoorBike", "elliptical", "rowing", "swim", "other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => {
    const parsed = new Date(d + "T12:00:00");
    return !Number.isNaN(parsed.getTime()) && localDate(parsed) === d;
  }, "Fecha inválida"),
  distanceKm: z.number().positive().max(2000).nullable(),
  durationSeconds: z.number().int().positive().max(604800),
  rpe: z.number().min(1).max(10).nullable(),
  notes: z.string().max(4000),
});
export type Cardio = z.infer<typeof cardioSchema>;
export function cardioPace(c: Cardio) {
  if (!c.distanceKm) return "Sin distancia";
  if (["bike", "indoorBike"].includes(c.activity)) return `${(c.distanceKm * 3600 / c.durationSeconds).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km/h`;
  if (!["run", "walk", "treadmill"].includes(c.activity)) return "";
  const seconds = Math.round(c.durationSeconds / c.distanceKm);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min/km`;
}
export function cardioDuration(seconds: number) {
  return `${Math.floor(seconds / 3600) ? Math.floor(seconds / 3600) + ":" : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function cardioWeek(items: Cardio[], today = localDate()) {
  const monday = new Date(today + "T12:00:00");
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = localDate(monday);
  const week = items.filter(c => c.date >= start && c.date <= today);
  return { count: week.length, km: week.reduce((n, c) => n + (c.distanceKm ?? 0), 0), minutes: week.reduce((n,c) => n + c.durationSeconds / 60, 0) };
}
export type Kind = "exercise" | "routine" | "plan" | "session" | "cardio";
export type Payload = Exercise | Routine | Plan | TrainingSession | Cardio;
export type CloudRecord = {
  id: string;
  kind: Kind;
  data: Payload;
  revision: number;
  deleted: boolean;
};
export type LocalRecord = CloudRecord & {
  owner: string;
  dirty: boolean;
  mutation: string;
  conflict?: CloudRecord;
};
export const uid = () => crypto.randomUUID();
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function prettyDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
export function createSession(
  routine: Routine | null,
  exercises: Exercise[],
  plan: Plan | null = null,
): TrainingSession {
  const items = (routine?.items ?? []).map((item) => {
    const exercise = exercises.find((e) => e.id === item.exerciseId);
    if (!exercise)
      throw new Error(
        "Un ejercicio de esta rutina ya no está disponible. Editá la rutina antes de empezar.",
      );
    return makeSessionItem(item, exercise);
  });
  return {
    id: uid(),
    planId: plan?.id ?? null,
    routineId: routine?.id ?? null,
    title: routine?.name ?? plan?.title ?? "Clase de calistenia",
    category: routine?.category ?? "class",
    date: localDate(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "active",
    items,
    notes: routine?.notes ?? "",
  };
}
export function makeSessionItem(
  item: RoutineItem,
  exercise: Exercise,
): SessionItem {
  return {
    ...structuredClone(item),
    exercise: structuredClone(exercise),
    skipped: false,
    sets: Array.from({ length: item.sets }, () => ({
      id: uid(),
      value: null,
      weight: null,
      rir: null,
      rpe: null,
      done: false,
    })),
  };
}
export function canComplete(set: TrainingSet, exercise: Exercise) {
  return (
    (exercise.unit === "check" || set.value !== null) &&
    (exercise.load === "none" || set.weight !== null)
  );
}
export function validatePayload(kind: Kind, data: unknown): Payload {
  return {
    exercise: exerciseSchema,
    routine: routineSchema,
    plan: planSchema,
    session: sessionSchema,
    cardio: cardioSchema,
  }[kind].parse(data);
}
export function backupParse(raw: unknown) {
  const base = z
    .object({
      version: z.literal(1),
      records: z
        .array(
          z.object({
            kind: z.enum(["exercise", "routine", "plan", "session", "cardio"]),
            data: z.unknown(),
          }),
        )
        .max(20000),
    })
    .parse(raw);
  return base.records.map((r) => ({
    kind: r.kind,
    data: validatePayload(r.kind, r.data),
  }));
}

