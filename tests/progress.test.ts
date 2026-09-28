import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, type Cardio } from "../lib/model";
import { seedExercises, seedRoutines } from "../lib/seeds";
import {
  previousItem,
  repeatPrevious,
  monthSummary,
  exercisePoints,
  bestCardioTimes,
} from "../lib/progress";
const session = createSession(seedRoutines[0], seedExercises);
session.id = "old";
session.status = "completed";
session.startedAt = "2026-09-01T12:00:00Z";
session.date = "2026-09-01";
const item = session.items[0];
item.sets[0] = {
  ...item.sets[0],
  value: 15,
  weight: 0,
  rir: 2,
  rpe: 8,
  done: true,
};
test("previous session uses compatible completed data, excludes current, future and skipped", () => {
  const next = structuredClone(session);
  next.id = "new";
  next.startedAt = "2026-09-02T12:00:00Z";
  assert.equal(
    previousItem([session, next], next, next.items[0])?.sets[0].rir,
    2,
  );
  const incompatible = structuredClone(session);
  incompatible.items[0].exercise.unit = "seconds";
  assert.equal(previousItem([incompatible], next, next.items[0]), undefined);
  const skipped = structuredClone(session);
  skipped.items[0].skipped = true;
  assert.equal(previousItem([skipped], next, next.items[0]), undefined);
});
test("repeat preserves completed sets and ids and never auto-completes pending sets", () => {
  const next = structuredClone(item);
  next.sets[0] = { ...next.sets[0], id: "new-set", done: false, value: null };
  const copied = repeatPrevious(next, item);
  assert.equal(copied.sets[0].id, "new-set");
  assert.equal(copied.sets[0].value, 15);
  assert.equal(copied.sets[0].weight, 0);
  assert.equal(copied.sets[0].rir, 2);
  assert.equal(copied.sets[0].done, false);
  next.sets[0].done = true;
  next.sets[0].value = 7;
  assert.equal(repeatPrevious(next, item).sets[0].value, 7);
});
const cardio: Cardio = {
  id: "c",
  activity: "run",
  date: "2026-09-01",
  distanceKm: 5,
  durationSeconds: 1500,
  rpe: null,
  notes: "",
};
test("monthly active days count shared strength/cardio dates only once", () => {
  assert.deepEqual(
    monthSummary(
      [session],
      [cardio, { ...cardio, id: "other", date: "2026-08-31" }],
      "2026-09",
    ),
    { days: 1, strength: 1, cardio: 1, minutes: 25, km: 5 },
  );
});
test("exercise graph excludes pending sets and treats less assistance as best", () => {
  const assisted = structuredClone(session);
  assisted.items[0].exercise.load = "assistance";
  assisted.items[0].sets.push(
    { ...item.sets[0], id: "second", weight: 20 },
    { ...item.sets[0], id: "third", weight: 50, done: false },
  );
  const data = exercisePoints([assisted], item.exercise.id);
  assert.equal(data.points[0].weight, 0);
  assert.equal(data.points[0].value, 15);
});
test("cardio best times only compare identical activity and distance", () => {
  const result = bestCardioTimes([
    cardio,
    { ...cardio, id: "faster", durationSeconds: 1400 },
    { ...cardio, id: "longer", distanceKm: 10 },
    { ...cardio, id: "walk", activity: "walk" },
  ]);
  assert.equal(result.length, 3);
  assert.ok(result.some((c) => c.id === "faster"));
  assert.ok(!result.some((c) => c.id === "c"));
});
