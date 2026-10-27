"use client";
import { useId } from "react";
export function ProgressionField({
  value,
  suggestions = [],
  onChange,
  disabled = false,
}: {
  value: string;
  suggestions?: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="progression-field">
      <label htmlFor={id}>Variante / progresión de hoy</label>
      <input
        id={id}
        list={id + "-list"}
        value={value}
        disabled={disabled}
        maxLength={120}
        placeholder="Ej. tuck, una pierna extendida, banda roja…"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id + "-list"}>
        {[...new Set(suggestions)].filter(Boolean).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <small>
        Escribí la variante que hiciste. Después cargá las reps o el tiempo de
        cada serie.
      </small>
    </div>
  );
}
