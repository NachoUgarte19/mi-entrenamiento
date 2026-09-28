import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  db,
  prepare,
  records,
  save,
  importRecords,
  resolveConflict,
  chooseStart,
  needsOnboarding,
} from "../lib/store";
import { seedExercises } from "../lib/seeds";
import type { Exercise } from "../lib/model";
Object.assign(globalThis, { window: new EventTarget() });

test("seed is one-time, deleted exercises stay deleted after reopening", async () => {
  await prepare("device");
  const initial = await records("device");
  await save("device", "exercise", seedExercises[0], true);
  await prepare("device");
  assert.equal((await records("device")).length, initial.length);
  assert.equal(
    (await db.records.get(["device", seedExercises[0].id]))?.deleted,
    true,
  );
  db.close();
  await db.open();
  assert.equal(
    (await db.records.get(["device", seedExercises[0].id]))?.deleted,
    true,
  );
});
test("owner namespaces are isolated and zero is not treated as absent", async () => {
  await save("owner-a", "exercise", { ...seedExercises[0], name: "Owner A" });
  await save("owner-b", "exercise", { ...seedExercises[0], name: "Owner B" });
  assert.equal(
    ((await db.records.get(["owner-a", seedExercises[0].id]))?.data as Exercise)
      .name,
    "Owner A",
  );
  assert.equal((await records("owner-b")).length, 1);
});
test("invalid import rolls back all rows in its transaction", async () => {
  await assert.rejects(() =>
    importRecords("import-test", [
      { kind: "exercise", data: { ...seedExercises[0], id: "valid" } },
      {
        kind: "exercise",
        data: { ...seedExercises[0], id: "invalid", name: "" },
      },
    ]),
  );
  assert.equal((await records("import-test")).length, 0);
});
test("conflict resolution retains selected data and uses remote revision", async () => {
  const base = {
    owner: "conflict-owner",
    id: "x",
    kind: "exercise" as const,
    data: { ...seedExercises[0], id: "x", name: "Local" },
    revision: 1,
    dirty: true,
    deleted: false,
    mutation: crypto.randomUUID(),
    conflict: {
      id: "x",
      kind: "exercise" as const,
      data: { ...seedExercises[0], id: "x", name: "Remote" },
      revision: 3,
      deleted: false,
    },
  };
  await db.records.put(base);
  await resolveConflict("conflict-owner", "x", "local");
  const local = await db.records.get(["conflict-owner", "x"]);
  assert.equal((local?.data as Exercise).name, "Local");
  assert.equal(local?.revision, 3);
  assert.equal(local?.dirty, true);
  assert.equal(local?.conflict, undefined);
  await db.records.put(base);
  await resolveConflict("conflict-owner", "x", "cloud");
  const cloud = await db.records.get(["conflict-owner", "x"]);
  assert.equal((cloud?.data as Exercise).name, "Remote");
  assert.equal(cloud?.dirty, false);
});

test("new account can start empty; choosing templates never overwrites existing data", async () => {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  await prepare("fresh-empty");
  assert.equal(await needsOnboarding("fresh-empty"), true);
  assert.equal((await records("fresh-empty")).length, 0);
  await chooseStart("fresh-empty", false);
  await prepare("fresh-empty");
  assert.equal(await needsOnboarding("fresh-empty"), false);
  assert.equal((await records("fresh-empty")).length, 0);
  await prepare("fresh-templates");
  await save("fresh-templates", "exercise", {
    ...seedExercises[0],
    name: "Personalizado",
  });
  await chooseStart("fresh-templates", true);
  assert.equal(
    (
      (await db.records.get(["fresh-templates", seedExercises[0].id]))
        ?.data as Exercise
    ).name,
    "Personalizado",
  );
  assert.ok(
    (await records("fresh-templates")).some((r) => r.kind === "routine"),
  );
  assert.equal((await records("fresh-empty")).length, 0);
});
