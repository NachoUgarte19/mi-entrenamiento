import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mobilityExercises, mobilityRoutine } from "../lib/mobility";
import { createSession, validatePayload } from "../lib/model";
import {
  db,
  addMobilityRoutine,
  records,
  save,
  LOCAL_OWNER,
} from "../lib/store";
Object.assign(globalThis, { window: new EventTarget() });

test("mobility routine follows the reference with correct recording units and rest", () => {
  validatePayload("routine", mobilityRoutine);
  for (const exercise of mobilityExercises)
    validatePayload("exercise", exercise);
  const session = createSession(mobilityRoutine, mobilityExercises);
  assert.equal(session.items.length, 11);
  assert.equal(session.items.flatMap((i) => i.sets).length, 16);
  assert.ok(session.items.every((i) => i.exercise.load === "none"));
  assert.deepEqual(
    session.items.map((i) => [
      i.exercise.unit,
      i.sets.length,
      i.target,
      i.rest,
    ]),
    [
      ...Array.from({ length: 5 }, () => ["seconds", 1, "60 seg", 0]),
      ["reps", 3, "8–12 reps", 30],
      ["seconds", 3, "10–15 seg", 30],
      ["reps", 2, "8–12 reps", 30],
      ...Array.from({ length: 3 }, () => ["seconds", 1, "60 seg", 0]),
    ],
  );
});

test("adding mobility to an existing account is atomic, repeatable and preserves customizations", async () => {
  const owner = "mobility-owner";
  const customized = {
    ...mobilityExercises[0],
    name: "Mis muñecas",
    notes: "Personalizado",
  };
  await save(owner, "exercise", customized);
  await save(owner, "exercise", { ...customized, id: "unrelated" });
  await Promise.all([addMobilityRoutine(owner), addMobilityRoutine(owner)]);
  const before = await records(owner);
  assert.equal(before.length, 13);
  assert.deepEqual(
    before.find((r) => r.id === customized.id)?.data,
    customized,
  );
  assert.equal(before.filter((r) => r.kind === "routine").length, 1);
  assert.ok(before.every((r) => r.dirty));
  await addMobilityRoutine(owner);
  assert.deepEqual(await records(owner), before);
  assert.equal((await records(LOCAL_OWNER)).length, 0);
  assert.equal((await records("another-account")).length, 0);
});

test("explicitly adding mobility restores deleted template records and retains their revision", async () => {
  const owner = "mobility-restore";
  await addMobilityRoutine(owner);
  const record = await db.records.get([owner, mobilityExercises[0].id]);
  await db.records.put({
    ...record!,
    deleted: true,
    revision: 4,
    dirty: false,
  });
  await save(owner, "routine", mobilityRoutine, true);
  await addMobilityRoutine(owner);
  assert.equal((await records(owner)).length, 12);
  const exercise = await db.records.get([owner, mobilityExercises[0].id]);
  assert.equal(exercise?.deleted, false);
  assert.equal(exercise?.dirty, true);
  assert.equal(exercise?.revision, 4);
  assert.equal(
    (await db.records.get([owner, mobilityRoutine.id]))?.deleted,
    false,
  );
});
