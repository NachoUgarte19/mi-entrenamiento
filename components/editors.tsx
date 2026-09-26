"use client";
import { useState } from "react";
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

export function ExerciseEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: Exercise;
  onSave: (e: Exercise) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Exercise>(
    initial ?? {
      id: uid(),
      name: "",
      group: "",
      unit: "reps",
      load: "none",
      notes: "",
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={initial ? "Editar ejercicio" : "Nuevo ejercicio"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(draft);
            onClose();
          } catch (err) {
            setError(String(err));
          } finally {
            setBusy(false);
          }
        }}
        className="form-grid"
      >
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
                setDraft({ ...draft, unit: e.target.value as Exercise["unit"] })
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
                setDraft({ ...draft, load: e.target.value as Exercise["load"] })
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
      </form>
    </Modal>
  );
}
export function RoutineEditor({
  initial,
  exercises,
  onSave,
  onClose,
}: {
  initial?: Routine;
  exercises: Exercise[];
  onSave: (r: Routine) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Routine>(
    initial
      ? structuredClone(initial)
      : { id: uid(), name: "", category: "pull", items: [], notes: "" },
  );
  const [addId, setAddId] = useState(exercises[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    <Modal
      title={initial ? "Editar rutina" : "Crear rutina"}
      description="Los cambios se aplican a los próximos entrenamientos. Tu historial conserva lo realizado."
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.items.length) {
            setError("Agregá al menos un ejercicio.");
            return;
          }
          setBusy(true);
          try {
            await onSave(draft);
            onClose();
          } catch (err) {
            setError(String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
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
                  <strong>{exercise?.name ?? "Ejercicio no disponible"}</strong>
                  <small>
                    {item.block} · {item.sets} × {item.target}
                  </small>
                </span>
              </summary>
              <div className="form-grid editor-inner">
                <label>
                  Ejercicio
                  <select
                    value={item.exerciseId}
                    onChange={(e) =>
                      change(item.id, { exerciseId: e.target.value })
                    }
                  >
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Bloque
                  <input
                    value={item.block}
                    maxLength={100}
                    onChange={(e) => change(item.id, { block: e.target.value })}
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
                    Objetivo
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
                  Indicaciones
                  <textarea
                    maxLength={4000}
                    value={item.notes}
                    onChange={(e) => change(item.id, { notes: e.target.value })}
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
          <label>
            Agregar desde tu biblioteca
            <select value={addId} onChange={(e) => setAddId(e.target.value)}>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!addId}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                items: [
                  ...d.items,
                  {
                    id: uid(),
                    exerciseId: addId,
                    sets: 3,
                    target: "8–10 reps",
                    block: "Trabajo principal",
                    rest: 90,
                    notes: "",
                    optional: false,
                    circuit: "",
                  },
                ],
              }))
            }
          >
            <Plus size={16} />
            Agregar ejercicio
          </Button>
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
      </form>
    </Modal>
  );
}
