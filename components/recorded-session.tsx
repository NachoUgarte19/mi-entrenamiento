"use client";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  completeRecordedSession,
  createSession,
  localDate,
  makeSessionItem,
  uid,
  type Exercise,
  type Plan,
  type Routine,
  type SessionItem,
  type TrainingSession,
  type TrainingSet,
} from "@/lib/model";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { ExerciseEditor } from "./editors";
import { SearchPicker } from "./search-picker";
import { ProgressionField } from "./progression-field";

const units = {
  reps: "Repeticiones",
  seconds: "Segundos",
  minutes: "Minutos",
  check: "Realizada",
};
const loads = {
  none: "",
  total: "Kg totales",
  each: "Kg por mancuerna",
  added: "Lastre (kg)",
  assistance: "Asistencia (kg)",
};
const emptySet = (): TrainingSet => ({
  id: uid(),
  value: null,
  weight: null,
  rir: null,
  rpe: null,
  done: false,
});

export function RecordedSessionEditor({
  date,
  plan,
  history,
  routines,
  exercises,
  onSave,
  onSaveExercise,
  onClose,
}: {
  date: string;
  plan?: Plan;
  history: TrainingSession[];
  routines: Routine[];
  exercises: Exercise[];
  onSave: (session: TrainingSession) => Promise<void>;
  onSaveExercise: (exercise: Exercise) => Promise<void>;
  onClose: () => void;
}) {
  const initialType = plan?.routineId ?? (plan ? "class" : "free");
  function build(type: string) {
    const routine = routines.find((r) => r.id === type) ?? null;
    const draft = createSession(routine, exercises, plan ?? null);
    return {
      ...draft,
      date,
      title:
        routine?.name ??
        (type === "class" ? "Clase de calistenia" : "Entrenamiento libre"),
      category:
        routine?.category ??
        (type === "class" ? ("class" as const) : ("full" as const)),
    };
  }
  const [type, setType] = useState(initialType);
  const [draft, setDraft] = useState(() => build(initialType));
  const [newExercise, setNewExercise] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  function changeItem(id: string, patch: Partial<SessionItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }
  function changeSet(
    item: SessionItem,
    id: string,
    field: "value" | "weight" | "rir" | "rpe",
    value: string,
  ) {
    changeItem(item.id, {
      sets: item.sets.map((s) =>
        s.id === id
          ? { ...s, [field]: value === "" ? null : Number(value) }
          : s,
      ),
    });
  }
  function addExercise(exercise: Exercise) {
    const item = makeSessionItem(
      {
        id: uid(),
        exerciseId: exercise.id,
        block: "Registro manual",
        sets: 1,
        target: "Libre",
        rest: 0,
        optional: false,
        notes: "",
        circuit: "",
      },
      exercise,
    );
    setDraft((d) => ({ ...d, items: [...d.items, item] }));
  }
  return (
    <>
      <Modal
        busy={busy}
        title="Cargar entrenamiento realizado"
        description="Registrá lo que hiciste ese día. Al guardar, las series cargadas contarán como realizadas."
        onClose={() => {
          if (!saving.current) onClose();
        }}
      >
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving.current) return;
            saving.current = true;
            setBusy(true);
            setError("");
            try {
              await onSave(completeRecordedSession(draft));
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "No pudimos guardar. Tus datos siguen acá; intentá nuevamente.",
              );
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="recorded-fields form-grid">
            <label>
              Fecha
              <input
                type="date"
                required
                max={localDate()}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>
              Tipo de entrenamiento
              <select
                value={type}
                disabled={!!plan}
                onChange={(e) => {
                  const next = e.target.value;
                  // Keep any exercises already entered when switching between free and class.
                  const base = build(next);
                  setDraft((d) => ({
                    ...base,
                    id: d.id,
                    date: d.date,
                    notes: d.notes,
                    items:
                      next === "free" || next === "class"
                        ? d.items
                        : base.items,
                  }));
                  setType(next);
                  setError("");
                }}
              >
                <option value="free">Libre · en casa o por tu cuenta</option>
                <option value="class">Clase de calistenia</option>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre del entrenamiento
              <input
                required
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="section-heading">
              <h3>Ejercicios realizados</h3>
              <span className="muted">{draft.items.length}</span>
            </div>
            {!draft.items.length && (
              <p className="muted">
                Agregá los ejercicios que hiciste, aunque no sigan una rutina.
              </p>
            )}
            {draft.items.map((item) => (
              <section
                className="recorded-item form-grid"
                key={item.id}
                aria-label={item.exercise.name}
              >
                <div className="section-heading">
                  <h3>{item.exercise.name}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={"Quitar " + item.exercise.name}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        items: d.items.filter((i) => i.id !== item.id),
                      }))
                    }
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
                <ProgressionField
                  suggestions={history
                    .flatMap((s) => s.items)
                    .filter((i) => i.exercise.id === item.exercise.id)
                    .map((i) => i.progression ?? "")}
                  value={item.progression ?? ""}
                  onChange={(progression) =>
                    changeItem(item.id, { progression })
                  }
                />
                {item.sets.map((set, index) => (
                  <div className="set-container" key={set.id}>
                    <div
                      className={
                        "set-row" +
                        (item.exercise.load !== "none" ? " weighted" : "")
                      }
                    >
                      <span className="set-number">{index + 1}</span>
                      {item.exercise.unit === "check" ? (
                        <span>Realizada</span>
                      ) : (
                        <label>
                          {units[item.exercise.unit]}
                          <input
                            aria-label={
                              item.exercise.name +
                              ", serie " +
                              (index + 1) +
                              ", " +
                              units[item.exercise.unit]
                            }
                            type="number"
                            required
                            min={0}
                            max={100000}
                            step="any"
                            value={set.value ?? ""}
                            onChange={(e) =>
                              changeSet(item, set.id, "value", e.target.value)
                            }
                          />
                        </label>
                      )}
                      {item.exercise.load !== "none" && (
                        <label>
                          {loads[item.exercise.load]}
                          <input
                            aria-label={
                              item.exercise.name +
                              ", serie " +
                              (index + 1) +
                              ", " +
                              loads[item.exercise.load]
                            }
                            type="number"
                            required
                            min={0}
                            max={2000}
                            step="any"
                            value={set.weight ?? ""}
                            onChange={(e) =>
                              changeSet(item, set.id, "weight", e.target.value)
                            }
                          />
                        </label>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={item.sets.length === 1}
                        aria-label={
                          "Quitar serie " +
                          (index + 1) +
                          " de " +
                          item.exercise.name
                        }
                        onClick={() =>
                          changeItem(item.id, {
                            sets: item.sets.filter((s) => s.id !== set.id),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <details className="effort">
                      <summary>RIR / RPE (opcional)</summary>
                      <div className="two-fields">
                        <label>
                          RIR
                          <input
                            aria-label={
                              item.exercise.name +
                              ", serie " +
                              (index + 1) +
                              ", RIR"
                            }
                            type="number"
                            min={0}
                            max={20}
                            step={1}
                            value={set.rir ?? ""}
                            onChange={(e) =>
                              changeSet(item, set.id, "rir", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          RPE
                          <input
                            aria-label={
                              item.exercise.name +
                              ", serie " +
                              (index + 1) +
                              ", RPE"
                            }
                            type="number"
                            min={1}
                            max={10}
                            step="any"
                            value={set.rpe ?? ""}
                            onChange={(e) =>
                              changeSet(item, set.id, "rpe", e.target.value)
                            }
                          />
                        </label>
                      </div>
                    </details>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={item.sets.length >= 30}
                  onClick={() =>
                    changeItem(item.id, { sets: [...item.sets, emptySet()] })
                  }
                >
                  <Plus size={16} />
                  Agregar serie
                </Button>
              </section>
            ))}
            <div className="add-exercise">
              <SearchPicker
                label="Agregar ejercicio"
                options={exercises.map((e) => ({ ...e, detail: e.group }))}
                resetAfterSelect
                disabled={busy}
                onCreate={setNewExercise}
                onSelect={(id) => {
                  const exercise = exercises.find((e) => e.id === id);
                  if (exercise) addExercise(exercise);
                }}
              />
              <small>
                Escribí y elegí una sugerencia. Si no existe, podés crearlo acá.
              </small>
            </div>
            <label>
              Notas
              <textarea
                maxLength={4000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Ej. Clase de ayer o entrenamiento en casa"
              />
            </label>
            <p className="muted text-small">
              Cargá solo las series que hiciste. Podés quitar ejercicios y
              series de una rutina.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar entrenamiento realizado"}
            </Button>
          </fieldset>
        </form>
      </Modal>
      {newExercise !== null && (
        <ExerciseEditor
          initialName={newExercise}
          onClose={() => setNewExercise(null)}
          onSave={async (exercise) => {
            await onSaveExercise(exercise);
            addExercise(exercise);
          }}
        />
      )}
    </>
  );
}
