import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completeRecordedSession,
  createSession,
  localDate,
} from "../lib/model";
import { seedExercises, seedRoutines } from "../lib/seeds";

function draft() {
  const session = createSession(seedRoutines[0], seedExercises);
  session.date = "2026-01-12";
  session.items = session.items.slice(0, 1);
  session.items[0].sets = [
    { id: "one", value: 8, weight: 0, rir: 2, rpe: 8, done: false },
  ];
  return session;
}
test("manual entry belongs to the workout day, completes entered sets and keeps the source unchanged", () => {
  const source = draft(),
    before = structuredClone(source);
  source.planId = "past-plan";
  before.planId = "past-plan";
  const session = completeRecordedSession(source);
  assert.equal(session.date, "2026-01-12");
  assert.equal(localDate(new Date(session.startedAt)), source.date);
  assert.equal(session.status, "completed");
  assert.equal(session.planId, "past-plan");
  assert.equal(session.items[0].sets[0].done, true);
  assert.equal(session.items[0].sets[0].weight, 0);
  assert.equal(session.items[0].sets[0].rir, 2);
  assert.equal(session.finishedAt, session.startedAt);
  assert.deepEqual(source, before);
});
test("manual entry rejects invalid or future dates", () => {
  for (const date of [
    "2026-02-30",
    "2026-13-01",
    "invalid",
    "2026-1-02",
    "9999-01-01",
  ]) {
    assert.throws(() => completeRecordedSession({ ...draft(), date }));
  }
  assert.doesNotThrow(() =>
    completeRecordedSession({ ...draft(), date: localDate() }),
  );
});
test("manual entry requires exercises, sets and complete results", () => {
  assert.throws(() => completeRecordedSession({ ...draft(), items: [] }));
  const session = draft();
  session.items[0].sets[0].value = null;
  assert.throws(() => completeRecordedSession(session));
  session.items[0].sets = [];
  assert.throws(() => completeRecordedSession(session));
  assert.throws(() => completeRecordedSession({ ...draft(), title: "   " }));
});
test("manual entry supports checked activities and rejects invalid effort", () => {
  const session = draft();
  session.items[0].exercise.unit = "check";
  session.items[0].exercise.load = "none";
  session.items[0].sets[0].value = null;
  assert.doesNotThrow(() => completeRecordedSession(session));
  session.items[0].sets[0].rpe = 11;
  assert.throws(() => completeRecordedSession(session));
});
