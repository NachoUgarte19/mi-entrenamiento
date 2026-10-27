"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  type Exercise,
  type Routine,
  type RoutineItem,
  type Category,
  labels,
  uid,
} from "@/lib/model";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { SearchPicker } from "./search-picker";

export function ExerciseEditor({
  initial,
  initialName = "",
  onSave,
  onClose,
}: {
  initial?: Exercise;
  initialName?: string;
  onSave: (e: Exercise) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Exercise>(
    initial ?? {
      id: uid(),
      name: initialName,
      group: "",
      unit: "reps",
      load: "none",
      notes: "",
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  return (
    <Modal
      title={initial ? "Editar ejercicio" : "Nuevo ejercicio"}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving.current) return;
          saving.current = true;
          setBusy(true);
          try {
            await onSave(draft);
            onClose();
          } catch (err) {
            setError(String(err));
          } finally {
            saving.current = false;
            setBusy(false);
          }
        }}
        className="form-grid"
      >
        <fieldset disabled={busy} className="editor-fields form-grid">
          <label>
            Nombre
            <input
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Remo en polea"
            />
          </label>
          <label>
            Grupo o enfoque
            <input
              maxLength={80}
              value={draft.group}
              onChange={(e) => setDraft({ ...draft, group: e.target.value })}
              placeholder="Ej. Tirón"
            />
          </label>
          <div className="two-fields">
            <label>
              Qué registrar
              <select
                value={draft.unit}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    unit: e.target.value as Exercise["unit"],
                  })
                }
              >
                <option value="reps">Repeticiones</option>
                <option value="seconds">Segundos</option>
                <option value="minutes">Minutos</option>
                <option value="check">Solo completar</option>
              </select>
            </label>
            <label>
              Carga
              <select
                value={draft.load}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    load: e.target.value as Exercise["load"],
                  })
                }
              >
                <option value="none">Sin carga</option>
                <option value="total">Kilos totales</option>
                <option value="each">Kilos por mancuerna</option>
                <option value="added">Lastre añadido</option>
                <option value="assistance">Asistencia en kilos</option>
              </select>
            </label>
          </div>
          <label>
            Notas de técnica
            <textarea
              value={draft.notes}
              maxLength={4000}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Guardando…" : "Guardar ejercicio"}
          </Button>
        </fieldset>
      </form>
    </Modal>
  );
}
export function RoutineEditor({
  initial,
  exercises,
  onSaveExercise,
  onSave,
  onClose,
}: {
  initial?: Routine;
  exercises: Exercise[];
  onSaveExercise: (exercise: Exercise) => Promise<void>;
  onSave: (r: Routine) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Routine>(
    initial
      ? structuredClone(initial)
      : { id: uid(), name: "", category: "pull", items: [], notes: "" },
  );
  const [newExercise, setNewExercise] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  function addExercise(exerciseId: string) {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          id: uid(),
          exerciseId,
          sets: 3,
          target: "8–10 reps",
          block: "Trabajo principal",
          rest: 90,
          notes: "",
          optional: false,
          circuit: "",
        },
      ],
    }));
    setError("");
  }
  const change = (id: string, patch: Partial<RoutineItem>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  const move = (index: number, by: number) =>
    setDraft((d) => {
      const items = [...d.items];
      [items[index], items[index + by]] = [items[index + by], items[index]];
      return { ...d, items };
    });
  return (
    <>
      <Modal
        title={initial ? "Editar rutina" : "Crear rutina"}
        description="Los cambios se aplican a los próximos entrenamientos. Tu historial conserva lo realizado."
        onClose={onClose}
        busy={busy}
      >
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving.current) return;
            if (!draft.items.length) {
              setError("Agregá al menos un ejercicio.");
              return;
            }
            saving.current = true;
            setBusy(true);
            try {
              await onSave(draft);
              onClose();
            } catch (err) {
              setError(String(err));
            } finally {
              saving.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="editor-fields form-grid">
            <label>
              Nombre de la rutina
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Jalón + zona media"
              />
            </label>
            <label>
              Etiqueta
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as Category })
                }
              >
                {(["pull", "push", "full", "class"] as const).map((c) => (
                  <option key={c} value={c}>
                    {labels[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="section-heading">
              <h3>Ejercicios</h3>
              <span className="muted">{draft.items.length} bloques</span>
            </div>
            {draft.items.map((item, index) => {
              const exercise = exercises.find((e) => e.id === item.exerciseId);
              return (
                <details className="editor-item" key={item.id}>
                  <summary>
                    <span className="ordinal">{index + 1}</span>
                    <span>
                      <strong>
                        {exercise?.name ?? "Ejercicio no disponible"}
                      </strong>
                      <small>
                        {item.block} · {item.sets} × {item.target}
                      </small>
                    </span>
                  </summary>
                  <div className="form-grid editor-inner">
                    <SearchPicker
                      label="Cambiar ejercicio"
                      options={exercises.map((e) => ({
                        ...e,
                        detail: e.group,
                      }))}
                      value={item.exerciseId}
                      onSelect={(id) => change(item.id, { exerciseId: id })}
                      disabled={busy}
                    />
                    <label>
                      Bloque
                      <input
                        value={item.block}
                        maxLength={100}
                        onChange={(e) =>
                          change(item.id, { block: e.target.value })
                        }
                      />
                    </label>
                    <div className="two-fields">
                      <label>
                        Series
                        <input
                          type="number"
                          required
                          min={1}
                          max={30}
                          value={item.sets || ""}
                          onChange={(e) =>
                            change(item.id, { sets: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Objetivo · reps o tiempo
                        <input
                          value={item.target}
                          maxLength={120}
                          onChange={(e) =>
                            change(item.id, { target: e.target.value })
                          }
                          placeholder="8–10 reps / máximo / RIR 3"
                        />
                      </label>
                    </div>
                    <div className="two-fields">
                      <label>
                        Descanso (segundos)
                        <input
                          type="number"
                          min={0}
                          max={1800}
                          required
                          value={item.rest}
                          onChange={(e) =>
                            change(item.id, { rest: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Circuito o superserie
                        <input
                          value={item.circuit}
                          maxLength={100}
                          placeholder="Ej. Circuito A"
                          onChange={(e) =>
                            change(item.id, { circuit: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Variante prevista / indicaciones
                      <textarea
                        placeholder="Ej. L-sit tuck; anotá la variante real al entrenar"
                        maxLength={4000}
                        value={item.notes}
                        onChange={(e) =>
                          change(item.id, { notes: e.target.value })
                        }
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={item.optional}
                        onChange={(e) =>
                          change(item.id, { optional: e.target.checked })
                        }
                      />{" "}
                      Ejercicio opcional
                    </label>
                    <div className="actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        disabled={index === 0}
                        aria-label="Subir ejercicio"
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={17} />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        disabled={index === draft.items.length - 1}
                        aria-label="Bajar ejercicio"
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={17} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            items: d.items.filter((i) => i.id !== item.id),
                          }))
                        }
                      >
                        <Trash2 size={16} />
                        Quitar
                      </Button>
                    </div>
                  </div>
                </details>
              );
            })}
            <div className="add-exercise">
              <SearchPicker
                label="Agregar ejercicio"
                options={exercises.map((e) => ({ ...e, detail: e.group }))}
                resetAfterSelect
                disabled={busy}
                onCreate={setNewExercise}
                onSelect={(id) => addExercise(id)}
              />
              <small>
                Escribí y tocá una sugerencia para sumarla a la rutina.
              </small>
            </div>
            <label>
              Notas generales
              <textarea
                maxLength={4000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar rutina"}
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
            addExercise(exercise.id);
          }}
        />
      )}
    </>
  );
}
