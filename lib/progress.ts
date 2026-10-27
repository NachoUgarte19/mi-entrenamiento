import { normalizeSearch } from "./exercise-search";
import {
  type TrainingSession,
  type SessionItem,
  type Cardio,
  localDate,
} from "./model";
export function previousItem(
  history: TrainingSession[],
  session: TrainingSession,
  item: SessionItem,
) {
  return [...history]
    .filter(
      (s) =>
        s.id !== session.id &&
        s.status === "completed" &&
        s.startedAt < session.startedAt,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.items)
    .find(
      (i) =>
        !i.skipped &&
        i.exercise.id === item.exercise.id &&
        normalizeSearch(i.progression ?? "") ===
          normalizeSearch(item.progression ?? "") &&
        i.exercise.unit === item.exercise.unit &&
        i.exercise.load === item.exercise.load &&
        i.sets.some((s) => s.done),
    );
}
export function repeatPrevious(
  item: SessionItem,
  previous: SessionItem,
): SessionItem {
  if (
    normalizeSearch(item.progression ?? "") !==
    normalizeSearch(previous.progression ?? "")
  )
    return item;
  const sets = previous.sets.filter((s) => s.done);
  return {
    ...item,
    sets: item.sets.map((s, i) =>
      s.done || !sets[i]
        ? s
        : {
            ...s,
            value: sets[i].value,
            weight: sets[i].weight,
            rir: sets[i].rir,
            rpe: sets[i].rpe,
            done: false,
          },
    ),
  };
}
export function monthSummary(
  sessions: TrainingSession[],
  cardio: Cardio[],
  month: string,
) {
  const strength = sessions.filter(
    (s) => s.status === "completed" && s.date.startsWith(month + "-"),
  );
  const aerobic = cardio.filter((c) => c.date.startsWith(month + "-"));
  return {
    days: new Set([
      ...strength.map((s) => s.date),
      ...aerobic.map((c) => c.date),
    ]).size,
    strength: strength.length,
    cardio: aerobic.length,
    minutes: aerobic.reduce((n, c) => n + c.durationSeconds / 60, 0),
    km: aerobic.reduce((n, c) => n + (c.distanceKm ?? 0), 0),
  };
}
export function exercisePoints(
  sessions: TrainingSession[],
  exerciseId: string,
  progression?: string,
) {
  const all = [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const latest = all
    .flatMap((s) => s.items)
    .filter(
      (i) =>
        i.exercise.id === exerciseId &&
        !i.skipped &&
        i.sets.some((s) => s.done) &&
        (progression === undefined ||
          normalizeSearch(i.progression ?? "") ===
            normalizeSearch(progression)),
    )
    .at(-1)?.exercise;
  if (!latest) return { exercise: undefined, points: [] };
  const points = all.flatMap((s) => {
    const sets = s.items
      .filter(
        (i) =>
          !i.skipped &&
          i.exercise.id === exerciseId &&
          (progression === undefined ||
            normalizeSearch(i.progression ?? "") ===
              normalizeSearch(progression)) &&
          i.exercise.unit === latest.unit &&
          i.exercise.load === latest.load,
      )
      .flatMap((i) => i.sets)
      .filter((s) => s.done);
    if (!sets.length) return [];
    const values = sets.flatMap((s) => (s.value === null ? [] : [s.value])),
      weights = sets.flatMap((s) => (s.weight === null ? [] : [s.weight]));
    return [
      {
        id: s.id,
        date: s.date,
        value: values.length ? Math.max(...values) : null,
        weight: weights.length
          ? latest.load === "assistance"
            ? Math.min(...weights)
            : Math.max(...weights)
          : null,
      },
    ];
  });
  return { exercise: latest, points };
}
export function bestCardioTimes(items: Cardio[]) {
  const best = new Map<string, Cardio>();
  for (const c of items) {
    if (c.distanceKm === null) continue;
    const key = c.activity + ":" + c.distanceKm;
    const old = best.get(key);
    if (!old || c.durationSeconds < old.durationSeconds) best.set(key, c);
  }
  return [...best.values()].sort(
    (a, b) =>
      a.activity.localeCompare(b.activity) ||
      (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
  );
}

export function progressionOptions(
  sessions: TrainingSession[],
  exerciseId: string,
) {
  const options = new Map<string, { id: string; name: string }>();
  for (const session of [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const item of session.items.filter(
      (i) =>
        i.exercise.id === exerciseId &&
        !i.skipped &&
        i.sets.some((s) => s.done),
    )) {
      const id = normalizeSearch(item.progression ?? "");
      options.delete(id);
      options.set(id, {
        id,
        name: item.progression?.trim() || "Sin variante registrada",
      });
    }
  }
  return [...options.values()];
}
