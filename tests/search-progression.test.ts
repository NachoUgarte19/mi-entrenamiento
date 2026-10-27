import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearch, searchOptions } from "../lib/exercise-search";
import { createSession, backupParse, type TrainingSession } from "../lib/model";
import { seedExercises, seedRoutines } from "../lib/seeds";
import {
  exercisePoints,
  previousItem,
  repeatPrevious,
  progressionOptions,
} from "../lib/progress";

test("exercise search ignores accents and case and matches all terms in name and group", () => {
  const options = [
    { id: "a", name: "Dominadas supinas", detail: "Tirón" },
    { id: "b", name: "Movilidad de hombros", detail: "Movilidad" },
    { id: "c", name: "Dominadas", detail: "Tirón" },
  ];
  assert.equal(normalizeSearch("  TIRÓN   SUPINAS "), "tiron supinas");
  assert.deepEqual(
    searchOptions(options, "tiron supinas").map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(
    searchOptions(options, "DOMINADAS").map((x) => x.id),
    ["c", "a"],
  );
  assert.equal(searchOptions(options, "no existe").length, 0);
});
function sample(
  id: string,
  date: string,
  progression: string | undefined,
  value: number,
): TrainingSession {
  const session = createSession(seedRoutines[0], seedExercises);
  session.id = id;
  session.date = date;
  session.startedAt = date + "T12:00:00Z";
  session.finishedAt = session.startedAt;
  session.status = "completed";
  session.items = session.items.slice(0, 1);
  session.items[0].exercise.unit = "seconds";
  session.items[0].progression = progression;
  session.items[0].sets = [
    { id: "set-" + id, value, weight: null, rir: null, rpe: null, done: true },
  ];
  return session;
}
test("progress graphs and previous results keep different variants separate", () => {
  const tuck1 = sample("a", "2026-10-01", "Tuck", 10),
    straight = sample("b", "2026-10-02", "Una pierna", 5),
    tuck2 = sample("c", "2026-10-03", " tuck ", 15);
  const history = [tuck1, straight, tuck2],
    exerciseId = tuck1.items[0].exercise.id;
  assert.deepEqual(
    exercisePoints(history, exerciseId, "TUCK").points.map((p) => p.value),
    [10, 15],
  );
  assert.deepEqual(
    exercisePoints(history, exerciseId, "Una pierna").points.map(
      (p) => p.value,
    ),
    [5],
  );
  assert.equal(previousItem(history, tuck2, tuck2.items[0])?.sets[0].value, 10);
  assert.equal(
    repeatPrevious(tuck2.items[0], straight.items[0]),
    tuck2.items[0],
  );
  assert.deepEqual(
    progressionOptions(history, exerciseId).map((o) => o.id),
    ["una pierna", "tuck"],
  );
});
test("legacy sessions remain available without a variant and do not mix with named variants", () => {
  const old = sample("old", "2026-09-01", undefined, 30),
    tuck = sample("new", "2026-10-01", "Tuck", 10);
  delete old.items[0].progression;
  const restored = backupParse({
    version: 1,
    records: [
      { kind: "session", data: old },
      { kind: "session", data: tuck },
    ],
  });
  assert.equal(restored.length, 2);
  assert.equal(
    exercisePoints([old, tuck], old.items[0].exercise.id, "").points[0].value,
    30,
  );
  assert.equal(
    exercisePoints([old, tuck], old.items[0].exercise.id, "Tuck").points[0]
      .value,
    10,
  );
  tuck.items[0].progression = "a".repeat(121);
  assert.throws(() =>
    backupParse({ version: 1, records: [{ kind: "session", data: tuck }] }),
  );
});
test("skipped and unfinished items do not change which units a chart uses", () => {
  const old = sample("old", "2026-10-01", "Tuck", 10),
    skipped = sample("skip", "2026-10-02", "Tuck", 20);
  skipped.items[0].skipped = true;
  skipped.items[0].exercise.unit = "reps";
  const result = exercisePoints(
    [old, skipped],
    old.items[0].exercise.id,
    "Tuck",
  );
  assert.equal(result.exercise?.unit, "seconds");
  assert.deepEqual(
    result.points.map((p) => p.value),
    [10],
  );
});
