import Dexie, { type Table } from "dexie";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type CloudRecord,
  type Kind,
  type LocalRecord,
  type Payload,
  uid,
  validatePayload,
} from "./model";
import { seedExercises, seedRoutines } from "./seeds";

class TrainingDB extends Dexie {
  records!: Table<LocalRecord, [string, string]>;
  meta!: Table<{ key: string; value: string }, string>;
  constructor() {
    super("mi-entrenamiento-v1");
    this.version(1).stores({ records: "[owner+id],owner,kind", meta: "key" });
  }
}
export const db = new TrainingDB();
export const LOCAL_OWNER = "device";
export function cloudConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
let client: SupabaseClient | null = null;
export function supabase() {
  if (!cloudConfigured()) return null;
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  ));
}
export const STORE_EVENT = "training-data-changed";
let channel: BroadcastChannel | undefined;
export function watchStore(callback: () => void) {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("training-data");
    channel.onmessage = () => window.dispatchEvent(new Event(STORE_EVENT));
  }
  window.addEventListener(STORE_EVENT, callback);
  return () => window.removeEventListener(STORE_EVENT, callback);
}
function notify() {
  window.dispatchEvent(new Event(STORE_EVENT));
  channel?.postMessage("changed");
}
export async function records(owner: string) {
  return db.records.where("owner").equals(owner).toArray();
}
export async function save(
  owner: string,
  kind: Kind,
  data: Payload,
  deleted = false,
) {
  const checked = validatePayload(kind, data);
  await db.transaction("rw", db.records, async () => {
    const old = await db.records.get([owner, checked.id]);
    await db.records.put({
      owner,
      id: checked.id,
      kind,
      data: checked,
      revision: old?.revision ?? 0,
      dirty: true,
      mutation: uid(),
      deleted,
      conflict: old?.conflict,
    });
  });
  notify();
}
export async function importRecords(
  owner: string,
  items: { kind: Kind; data: Payload }[],
) {
  await db.transaction("rw", db.records, async () => {
    for (const item of items) {
      const data = validatePayload(item.kind, item.data),
        old = await db.records.get([owner, data.id]);
      await db.records.put({
        owner,
        id: data.id,
        kind: item.kind,
        data,
        revision: old?.revision ?? 0,
        deleted: false,
        dirty: true,
        mutation: uid(),
        conflict: old?.conflict,
      });
    }
  });
  notify();
}
function decodeCloud(row: Record<string, unknown>): CloudRecord {
  const kind = row.kind as Kind;
  if (!["exercise", "routine", "plan", "session"].includes(kind))
    throw Error("La nube devolvió un tipo de registro desconocido.");
  return {
    id: String(row.id),
    kind,
    data: validatePayload(kind, row.data),
    revision: Number(row.revision),
    deleted: Boolean(row.deleted),
  };
}
async function pull(owner: string) {
  const api = supabase();
  if (!api) return;
  let from = 0;
  while (true) {
    const { data, error } = await api
      .from("training_records")
      .select("id,kind,data,revision,deleted")
      .eq("owner_id", owner)
      .order("id")
      .range(from, from + 499);
    if (error) throw error;
    await db.transaction("rw", db.records, async () => {
      for (const raw of data ?? []) {
        const remote = decodeCloud(raw),
          local = await db.records.get([owner, remote.id]);
        if (!local || (!local.dirty && remote.revision > local.revision)) {
          await db.records.put({
            ...remote,
            owner,
            dirty: false,
            mutation: uid(),
          });
        }
      }
    });
    if ((data?.length ?? 0) < 500) break;
    from += 500;
  }
}
export async function prepare(owner: string) {
  if (await db.meta.get("initialized:" + owner)) return;
  if (owner !== LOCAL_OWNER) {
    if (!navigator.onLine)
      throw Error(
        "Conectate una vez para cargar tu cuenta en este dispositivo.",
      );
    await pull(owner);
  }
  await db.transaction("rw", db.records, db.meta, async () => {
    if (await db.meta.get("initialized:" + owner)) return;
    for (const [kind, seeds] of [
      ["exercise", seedExercises],
      ["routine", seedRoutines],
    ] as const) {
      for (const data of seeds) {
        if (!(await db.records.get([owner, data.id])))
          await db.records.put({
            owner,
            id: data.id,
            kind,
            data,
            revision: 0,
            deleted: false,
            dirty: true,
            mutation: uid(),
          });
      }
    }
    await db.meta.put({ key: "initialized:" + owner, value: "1" });
  });
  notify();
}
const running = new Map<string, Promise<void>>();
export function synchronize(owner: string) {
  if (owner === LOCAL_OWNER || !navigator.onLine || !supabase())
    return Promise.resolve();
  if (running.has(owner)) return running.get(owner)!;
  const task = (async () => {
    for (const local of (await records(owner)).filter(
      (r) => r.dirty && !r.conflict,
    )) {
      const { data, error } = await supabase()!.rpc("apply_training_record", {
        record_id: local.id,
        record_kind: local.kind,
        record_data: local.data,
        is_deleted: local.deleted,
        expected_revision: local.revision,
        mutation_id: local.mutation,
      });
      if (error) throw error;
      const remote = decodeCloud(data.record);
      await db.transaction("rw", db.records, async () => {
        const current = await db.records.get([owner, local.id]);
        if (!current) return;
        if (!data.ok) {
          await db.records.put({ ...current, conflict: remote });
          return;
        }
        // A save during the request stays pending, based on the revision just accepted.
        await db.records.put({
          ...current,
          revision: remote.revision,
          dirty: current.mutation !== local.mutation,
          conflict: undefined,
        });
      });
    }
    await pull(owner);
    notify();
  })().finally(() => running.delete(owner));
  running.set(owner, task);
  return task;
}
export async function resolveConflict(
  owner: string,
  id: string,
  use: "local" | "cloud",
) {
  await db.transaction("rw", db.records, async () => {
    const record = await db.records.get([owner, id]);
    if (!record?.conflict) return;
    const remote = record.conflict;
    if (use === "cloud")
      await db.records.put({ ...remote, owner, dirty: false, mutation: uid() });
    else
      await db.records.put({
        ...record,
        revision: remote.revision,
        dirty: true,
        mutation: uid(),
        conflict: undefined,
      });
  });
  notify();
}
