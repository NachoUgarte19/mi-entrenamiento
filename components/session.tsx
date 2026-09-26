"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Timer, X } from "lucide-react";
import {
  canComplete,
  makeSessionItem,
  uid,
  type Exercise,
  type SessionItem,
  type TrainingSession,
  type TrainingSet,
} from "@/lib/model";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

const units = {
  reps: "Reps",
  seconds: "Segundos",
  minutes: "Minutos",
  check: "Completado",
};
const loads = {
  none: "",
  total: "Kg totales",
  each: "Kg por mancuerna",
  added: "Lastre (kg)",
  assistance: "Asistencia (kg)",
};
export function SessionView({
  initial,
  exercises,
  history,
  onSave,
  onBack,
  onFinish,
}: {
  initial: TrainingSession;
  exercises: Exercise[];
  history: TrainingSession[];
  onSave: (s: TrainingSession) => Promise<void>;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [session, setSession] = useState(initial),
    [index, setIndex] = useState(0),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [add, setAdd] = useState(false),
    [addId, setAddId] = useState(exercises[0]?.id ?? ""),
    [confirm, setConfirm] = useState(false),
    [timerEnd, setTimerEnd] = useState<number | null>(null),
    [remaining, setRemaining] = useState(0),
    [timerDone, setTimerDone] = useState(false);
  const current = useRef(session),
    queue = useRef(Promise.resolve()),
    pending = useRef(0),
    failed = useRef(false);
  const readonly = session.status === "completed";
  function update(next: TrainingSession) {
    current.current = next;
    setSession(next);
    pending.current++;
    setSaving(true);
    failed.current = false;
    setError("");
    queue.current = queue.current
      .catch(() => {})
      .then(() => onSave(next))
      .catch(() => {
        failed.current = true;
        setError(
          "No se pudo guardar. Reintentá antes de salir de esta sesión.",
        );
      })
      .finally(() => {
        pending.current--;
        if (!pending.current) setSaving(false);
      });
  }
  function itemUpdate(item: SessionItem) {
    update({
      ...current.current,
      items: current.current.items.map((x) => (x.id === item.id ? item : x)),
    });
  }
  function setUpdate(id: string, patch: Partial<TrainingSet>) {
    const item = current.current.items[index];
    itemUpdate({
      ...item,
      sets: item.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || failed.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!timerEnd) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) {
        setTimerEnd(null);
        setTimerDone(true);
        navigator.vibrate?.(150);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [timerEnd]);
  const item = session.items[index];
  const done = session.items
    .flatMap((i) => i.sets)
    .filter((s) => s.done).length;
  const total = session.items
    .filter((i) => !i.skipped)
    .flatMap((i) => i.sets).length;
  const previous = item
    ? history
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
            i.exercise.id === item.exercise.id && i.sets.some((s) => s.done),
        )
    : undefined;
  const leave = async () => {
    await queue.current;
    if (!failed.current) onBack();
  };
  async function finish() {
    await queue.current;
    if (failed.current) return;
    setSaving(true);
    try {
      const next = {
        ...current.current,
        status: "completed" as const,
        finishedAt: new Date().toISOString(),
      };
      await onSave(next);
      setSession(next);
      current.current = next;
      onFinish();
    } catch {
      setError("No se pudo finalizar. Tus series siguen en esta sesión.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="session-view">
      <Button variant="ghost" onClick={leave}>
        <ArrowLeft size={17} />
        Volver
      </Button>
      <div className="section-heading">
        <span className={"badge " + session.category}>
          {readonly ? "Historial" : "En curso"}
        </span>
        <span role="status" className="save-state">
          {saving
            ? "Guardando…"
            : error
              ? "Pendiente de guardar"
              : "Guardado en el dispositivo"}
        </span>
      </div>
      <h1>{session.title}</h1>
      <div className="section-heading">
        <span className="muted">
          {done} de {total} series completadas
        </span>
      </div>
      <progress
        max={Math.max(total, 1)}
        value={done}
        aria-label="Series completadas"
      />
      {item ? (
        <>
          <label className="exercise-picker">
            Ejercicio {index + 1} de {session.items.length}
            <select
              value={index}
              onChange={(e) => {
                setIndex(Number(e.target.value));
                setError("");
              }}
            >
              {session.items.map((i, n) => (
                <option key={i.id} value={n}>
                  {i.exercise.name}
                  {i.skipped ? " · omitido" : ""}
                  {i.optional ? " · opcional" : ""}
                </option>
              ))}
            </select>
          </label>
          <section className="panel exercise-panel">
            <div className="eyebrow">
              {item.block}
              {item.optional ? " · opcional" : ""}
            </div>
            <h2>{item.exercise.name}</h2>
            <p className="muted">
              {item.sets.length} series · {item.target}
            </p>
            {item.circuit && (
              <p className="circuit-label">
                {item.circuit} · alterná ejercicios por ronda
              </p>
            )}
            {(item.exercise.notes || item.notes) && (
              <div className="technique">
                {item.exercise.notes}
                {item.exercise.notes && item.notes ? " " : ""}
                {item.notes}
              </div>
            )}
            {previous && (
              <p className="previous">
                Última vez:{" "}
                {previous.sets
                  .filter((s) => s.done)
                  .map(
                    (s) =>
                      `${s.value ?? "✓"}${s.weight !== null ? ` (${s.weight} kg)` : ""}`,
                  )
                  .join(" / ")}{" "}
                {units[item.exercise.unit].toLowerCase()}
              </p>
            )}
            {item.skipped ? (
              <div className="empty compact">
                <p>Ejercicio omitido en esta sesión.</p>
                {!readonly && (
                  <Button
                    variant="secondary"
                    onClick={() => itemUpdate({ ...item, skipped: false })}
                  >
                    Volver a incluir
                  </Button>
                )}
              </div>
            ) : (
              <div className="sets">
                {item.sets.map((set, n) => (
                  <div
                    key={set.id}
                    className={"set-container " + (set.done ? "is-done" : "")}
                  >
                    <div
                      className={
                        "set-row " +
                        (item.exercise.load !== "none" ? "weighted" : "")
                      }
                    >
                      <span className="set-number">{n + 1}</span>
                      {item.exercise.unit === "check" ? (
                        <span>Completar</span>
                      ) : (
                        <label>
                          {units[item.exercise.unit]}
                          <input
                            aria-label={`Serie ${n + 1}, ${units[item.exercise.unit]}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100000"
                            step={item.exercise.unit === "reps" ? 1 : "any"}
                            disabled={readonly}
                            placeholder="—"
                            value={set.value ?? ""}
                            onChange={(e) => {
                              if (!e.target.validity.valid) return;
                              setUpdate(set.id, {
                                value:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                done: false,
                              });
                            }}
                          />
                        </label>
                      )}
                      {item.exercise.load !== "none" && (
                        <label>
                          {loads[item.exercise.load]}
                          <input
                            aria-label={`Serie ${n + 1}, kilos`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="2000"
                            step="any"
                            disabled={readonly}
                            value={set.weight ?? ""}
                            placeholder={
                              item.exercise.load === "added" ? "0" : "—"
                            }
                            onChange={(e) => {
                              if (!e.target.validity.valid) return;
                              setUpdate(set.id, {
                                weight:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                                done: false,
                              });
                            }}
                          />
                        </label>
                      )}
                      <Button
                        size="icon"
                        variant={set.done ? "default" : "secondary"}
                        disabled={readonly}
                        aria-label={`${set.done ? "Desmarcar" : "Completar"} serie ${n + 1}`}
                        aria-pressed={set.done}
                        onClick={() => {
                          if (!set.done && !canComplete(set, item.exercise)) {
                            setError(
                              "Cargá el resultado y la carga. Para peso corporal sin lastre, ingresá 0 kg.",
                            );
                            return;
                          }
                          setError("");
                          setUpdate(set.id, { done: !set.done });
                        }}
                      >
                        <Check size={20} />
                      </Button>
                    </div>
                    <details className="effort">
                      <summary>
                        RIR / RPE{" "}
                        {set.rir !== null || set.rpe !== null
                          ? `· ${set.rir ?? "—"} / ${set.rpe ?? "—"}`
                          : "· opcional"}
                      </summary>
                      <div className="two-fields">
                        <label>
                          RIR
                          <input
                            aria-label={`Serie ${n + 1}, RIR`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={20}
                            disabled={readonly}
                            value={set.rir ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              if (e.target.validity.valid)
                                setUpdate(set.id, {
                                  rir:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                });
                            }}
                          />
                        </label>
                        <label>
                          RPE
                          <input
                            aria-label={`Serie ${n + 1}, RPE`}
                            type="number"
                            inputMode="decimal"
                            min={1}
                            max={10}
                            step={0.5}
                            disabled={readonly}
                            value={set.rpe ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              if (e.target.validity.valid)
                                setUpdate(set.id, {
                                  rpe:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                });
                            }}
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
            {!readonly && (
              <div className="actions wrap">
                <Button
                  variant="ghost"
                  onClick={() =>
                    itemUpdate({
                      ...item,
                      sets: [
                        ...item.sets,
                        {
                          id: uid(),
                          value: null,
                          weight: null,
                          rir: null,
                          rpe: null,
                          done: false,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Serie
                </Button>
                {!item.sets.some((s) => s.done) && !item.skipped && (
                  <Button
                    variant="ghost"
                    onClick={() => itemUpdate({ ...item, skipped: true })}
                  >
                    Omitir ejercicio
                  </Button>
                )}
              </div>
            )}
          </section>
          {!readonly && (
            <div className="rest">
              <Timer size={20} />
              <span>
                Descanso
                <br />
                <small>
                  {timerEnd
                    ? "En curso"
                    : item.rest
                      ? "Sugerido en tu rutina"
                      : "Sin pausa pautada"}
                </small>
              </span>
              <strong aria-live="off">
                {Math.floor(
                  (timerDone ? 0 : timerEnd ? remaining : item.rest) / 60,
                )}
                :
                {String(
                  (timerDone ? 0 : timerEnd ? remaining : item.rest) % 60,
                ).padStart(2, "0")}
              </strong>
              <Button
                variant="ghost"
                disabled={!item.rest && !timerEnd}
                onClick={() => {
                  setTimerDone(false);
                  setTimerEnd(timerEnd ? null : Date.now() + item.rest * 1000);
                }}
              >
                {timerEnd ? "Detener" : "Iniciar"}
              </Button>
            </div>
          )}
          <div className="actions">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
              aria-label="Ejercicio anterior"
            >
              <ArrowLeft size={18} />
            </Button>
            <Button
              className="grow"
              onClick={() =>
                index < session.items.length - 1
                  ? setIndex(index + 1)
                  : readonly
                    ? onBack()
                    : setConfirm(true)
              }
            >
              {index < session.items.length - 1
                ? "Siguiente ejercicio"
                : readonly
                  ? "Volver"
                  : "Finalizar sesión"}
              <ArrowRight size={18} />
            </Button>
          </div>
        </>
      ) : (
        <div className="empty">
          <h2>Empezá tu clase</h2>
          <p>Sumá los ejercicios a medida que los hagas.</p>
        </div>
      )}
      {!readonly && (
        <Button variant="ghost" className="full" onClick={() => setAdd(true)}>
          <Plus size={17} />
          Agregar ejercicio
        </Button>
      )}
      <details className="session-notes">
        <summary>Notas de la sesión</summary>
        <textarea
          disabled={readonly}
          value={session.notes}
          onChange={(e) =>
            update({ ...current.current, notes: e.target.value })
          }
        />
      </details>
      {error && (
        <div className="error" role="alert">
          {error}
          {failed.current && (
            <Button variant="secondary" onClick={() => update(current.current)}>
              Reintentar guardado
            </Button>
          )}
        </div>
      )}
      {!readonly && (
        <Button
          variant="ghost"
          className="full"
          disabled={saving}
          onClick={() => setConfirm(true)}
        >
          Terminar por hoy
        </Button>
      )}
      {add && (
        <Modal title="Agregar ejercicio" onClose={() => setAdd(false)}>
          <div className="form-grid">
            <label>
              Ejercicio
              <select value={addId} onChange={(e) => setAddId(e.target.value)}>
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!addId}
              onClick={() => {
                const ex = exercises.find((e) => e.id === addId);
                if (!ex) return;
                const next = makeSessionItem(
                  {
                    id: uid(),
                    exerciseId: ex.id,
                    sets: 3,
                    target: "Libre",
                    block: "Agregado en sesión",
                    rest: 90,
                    optional: false,
                    notes: "",
                    circuit: "",
                  },
                  ex,
                );
                update({
                  ...current.current,
                  items: [...current.current.items, next],
                });
                setIndex(current.current.items.length - 1);
                setAdd(false);
              }}
            >
              Agregar a esta sesión
            </Button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title="¿Terminaste por hoy?"
          description={`${done} series completadas. Las series pendientes quedarán sin completar en el historial.`}
          onClose={() => setConfirm(false)}
        >
          <div className="form-grid">
            <Button disabled={saving} onClick={finish}>
              Finalizar y guardar
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              <X size={16} />
              Seguir entrenando
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
