"use client";
import { useState } from "react";
import {
  type TrainingSession,
  type Cardio,
  cardioActivities,
  cardioDuration,
  localDate,
} from "@/lib/model";
import { monthSummary, exercisePoints, bestCardioTimes } from "@/lib/progress";
export function ProgressDetails({
  sessions,
  cardio,
  exerciseId,
}: {
  sessions: TrainingSession[];
  cardio: Cardio[];
  exerciseId: string;
}) {
  const [month, setMonth] = useState(localDate().slice(0, 7)),
    [metric, setMetric] = useState<"value" | "weight">("value");
  const summary = monthSummary(sessions, cardio, month),
    { exercise, points } = exercisePoints(sessions, exerciseId);
  const unit =
    exercise?.unit === "seconds"
      ? "segundos"
      : exercise?.unit === "minutes"
        ? "minutos"
        : "repeticiones";
  const selectedMetric =
    exercise?.unit === "check"
      ? "weight"
      : exercise?.load === "none"
        ? "value"
        : metric;
  const series = points.flatMap((p) =>
    p[selectedMetric] === null ? [] : [{ ...p, y: p[selectedMetric]! }],
  );
  const max = Math.max(1, ...series.map((p) => p.y));
  const coords = series
    .map(
      (p, i) =>
        `${40 + (series.length === 1 ? 210 : (i * 420) / (series.length - 1))},${160 - (p.y / max) * 130}`,
    )
    .join(" ");
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value])),
    weights = points.flatMap((p) => (p.weight === null ? [] : [p.weight]));
  return (
    <section className="progress-details">
      <div className="panel">
        <label>
          Resumen mensual
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <div className="summary-grid">
          {[
            [summary.days, "días activos"],
            [summary.strength, "sesiones de fuerza"],
            [summary.cardio, "sesiones de cardio"],
            [Math.round(summary.minutes), "min de cardio"],
            [
              summary.km.toLocaleString("es-AR", { maximumFractionDigits: 2 }),
              "km de cardio",
            ],
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      {exercise && (
        <div className="panel">
          <h2>{exercise.name}: evolución y récords</h2>
          <p className="muted">
            Mejor serie de cada sesión. Solo series completadas con la misma
            unidad y tipo de carga.
          </p>
          <div className="actions">
            {values.length > 0 && exercise.unit !== "check" && (
              <span className="record-chip">
                Máximo: {Math.max(...values)} {unit}
              </span>
            )}
            {weights.length > 0 && exercise.load !== "none" && (
              <span className="record-chip">
                {exercise.load === "assistance"
                  ? "Menor asistencia"
                  : exercise.load === "added"
                    ? "Mayor lastre"
                    : "Mayor carga"}
                :{" "}
                {exercise.load === "assistance"
                  ? Math.min(...weights)
                  : Math.max(...weights)}{" "}
                kg{exercise.load === "each" ? " por mancuerna" : ""}
              </span>
            )}
          </div>
          {exercise.unit !== "check" && exercise.load !== "none" && (
            <label>
              Mostrar
              <select
                value={metric}
                onChange={(e) =>
                  setMetric(e.target.value as "value" | "weight")
                }
              >
                <option value="value">{unit}</option>
                <option value="weight">
                  {exercise.load === "assistance"
                    ? "Asistencia (kg)"
                    : "Carga (kg)"}
                </option>
              </select>
            </label>
          )}
          {series.length > 0 ? (
            <>
              <svg
                className="exercise-chart"
                viewBox="0 0 500 195"
                role="img"
                aria-label={`Evolución de ${exercise.name} en ${selectedMetric === "weight" ? "kg" : unit}`}
              >
                <line x1="40" y1="160" x2="460" y2="160" stroke="#cbd5e1" />
                <text x="4" y="32" fontSize="12">
                  {max.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                </text>
                <text x="15" y="164" fontSize="12">
                  0
                </text>
                <polyline
                  points={coords}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="3"
                />
                {series.map((p, i) => (
                  <circle
                    key={p.id}
                    cx={
                      40 +
                      (series.length === 1
                        ? 210
                        : (i * 420) / (series.length - 1))
                    }
                    cy={160 - (p.y / max) * 130}
                    r="4"
                    fill="#0f766e"
                  >
                    <title>
                      {p.date}: {p.y}
                    </title>
                  </circle>
                ))}
                <text x="40" y="188" fontSize="12">
                  {series[0].date}
                </text>
                <text x="460" y="188" textAnchor="end" fontSize="12">
                  {series.at(-1)!.date}
                </text>
              </svg>
              <details>
                <summary>Ver valores del gráfico</summary>
                <ul>
                  {series.map((p) => (
                    <li key={p.id}>
                      {p.date}: {p.y}{" "}
                      {selectedMetric === "weight" ? "kg" : unit}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p>Completá series para ver tu evolución.</p>
          )}
        </div>
      )}
      {cardio.some((c) => c.distanceKm !== null) && (
        <div className="panel">
          <h2>Mejores tiempos de cardio</h2>
          <p className="muted">
            Comparados dentro de la misma actividad y distancia exacta.
          </p>
          <div className="cardio-bests">
            {bestCardioTimes(cardio).map((c) => (
              <p key={c.id}>
                <strong>
                  {cardioActivities[c.activity]} · {c.distanceKm} km
                </strong>
                <span>
                  {cardioDuration(c.durationSeconds)} · {c.date}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
