import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, canComplete, backupParse } from "../lib/model";
import { seedExercises, seedRoutines } from "../lib/seeds";

test("sessions snapshot routine and exercise data independently", () => {
  const routine = structuredClone(seedRoutines[0]),
    exercises = structuredClone(seedExercises);
  const session = createSession(routine, exercises);
  const name = session.items[0].exercise.name,
    target = session.items[0].target;
  routine.name = "changed";
  routine.items[0].target = "different";
  exercises[0].name = "changed";
  assert.equal(session.title, "Jalón + zona media");
  assert.equal(session.items[0].exercise.name, name);
  assert.equal(session.items[0].target, target);
  assert.ok(
    session.items.every((i) =>
      i.sets.every((s) => !s.done && s.value === null),
    ),
  );
});
test("zero lastre is a valid result; missing input is not", () => {
  const ex = seedExercises.find((e) => e.id === "chinup")!;
  const set = {
    id: "s",
    value: 8,
    weight: null,
    rir: null,
    rpe: null,
    done: false,
  };
  assert.equal(canComplete(set, ex), false);
  assert.equal(canComplete({ ...set, weight: 0 }, ex), true);
  assert.equal(canComplete({ ...set, value: null, weight: 0 }, ex), false);
});
test("backup validation rejects malformed results and unsupported format", () => {
  assert.throws(() => backupParse({ version: 2, records: [] }));
  const session = createSession(seedRoutines[0], seedExercises);
  session.items[0].sets[0].rpe = 11;
  assert.throws(() =>
    backupParse({ version: 1, records: [{ kind: "session", data: session }] }),
  );
});
test("all three routines resolve their exercises and preserve prescribed rests", () => {
  for (const routine of seedRoutines)
    assert.doesNotThrow(() => createSession(routine, seedExercises));
  assert.equal(
    seedRoutines[0].items.find((i) => i.exerciseId === "plank")!.rest,
    10,
  );
  assert.equal(
    seedRoutines[2].items.find((i) => i.exerciseId === "commando-left")!.rest,
    180,
  );
  const circuit = seedRoutines[0].items.filter((i) => i.circuit);
  assert.equal(circuit.length, 4);
  assert.ok(circuit.every((i) => i.sets === 2));
});
