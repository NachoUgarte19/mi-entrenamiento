import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, save, synchronize } from "../lib/store";
import { seedExercises } from "../lib/seeds";
import type { CloudRecord, Exercise } from "../lib/model";

Object.assign(globalThis, { window: new EventTarget() });
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";

test("sync keeps edits during upload, retries idempotently, and exposes conflicts", async () => {
  const owner = "sync-test";
  let remote: CloudRecord | null = null,
    lastMutation = "",
    interleave = false,
    dropResponse = false;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/rpc/")) {
      const request = JSON.parse(String(init?.body));
      if (interleave) {
        interleave = false;
        await save(owner, "exercise", {
          ...seedExercises[0],
          id: "sync-exercise",
          name: "New edit during upload",
        });
      }
      const duplicate = lastMutation === request.mutation_id;
      const ok =
        duplicate || (remote?.revision ?? 0) === request.expected_revision;
      if (ok && !duplicate) {
        remote = {
          id: request.record_id,
          kind: request.record_kind,
          data: request.record_data,
          revision: (remote?.revision ?? 0) + 1,
          deleted: request.is_deleted,
        };
        lastMutation = request.mutation_id;
      }
      if (dropResponse) {
        dropResponse = false;
        throw Error("Simulated dropped response");
      }
      return new Response(JSON.stringify({ ok, record: remote }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/training_records"))
      return new Response(JSON.stringify(remote ? [remote] : []), {
        headers: { "Content-Type": "application/json" },
      });
    throw Error("Unexpected request: " + url);
  };
  try {
    await save(owner, "exercise", {
      ...seedExercises[0],
      id: "sync-exercise",
      name: "First edit",
    });
    interleave = true;
    await synchronize(owner);
    let local = await db.records.get([owner, "sync-exercise"]);
    assert.equal(local?.dirty, true);
    assert.equal(local?.revision, 1);
    assert.equal((local?.data as Exercise).name, "New edit during upload");
    await synchronize(owner);
    local = await db.records.get([owner, "sync-exercise"]);
    assert.equal(local?.dirty, false);
    assert.equal(local?.revision, 2);
    await save(owner, "exercise", {
      ...seedExercises[0],
      id: "sync-exercise",
      name: "Retry safely",
    });
    dropResponse = true;
    await assert.rejects(() => synchronize(owner));
    assert.equal((await db.records.get([owner, "sync-exercise"]))?.dirty, true);
    await synchronize(owner);
    local = await db.records.get([owner, "sync-exercise"]);
    assert.equal(local?.revision, 3);
    assert.equal(local?.dirty, false);
    remote = {
      ...(remote as unknown as CloudRecord),
      revision: 4,
      data: {
        ...seedExercises[0],
        id: "sync-exercise",
        name: "Another device",
      },
    };
    await save(owner, "exercise", {
      ...seedExercises[0],
      id: "sync-exercise",
      name: "Conflicting local edit",
    });
    await synchronize(owner);
    local = await db.records.get([owner, "sync-exercise"]);
    assert.equal(local?.conflict?.revision, 4);
    assert.equal((local?.data as Exercise).name, "Conflicting local edit");
    assert.equal((local?.conflict?.data as Exercise).name, "Another device");
  } finally {
    globalThis.fetch = oldFetch;
  }
});
