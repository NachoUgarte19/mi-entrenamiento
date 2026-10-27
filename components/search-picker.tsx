"use client";
import { useId, useRef, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import {
  normalizeSearch,
  searchOptions,
  type SearchOption,
} from "@/lib/exercise-search";
import { Button } from "./ui/button";

export function SearchPicker({
  label,
  options,
  value,
  onSelect,
  onCreate,
  placeholder = "Escribí el nombre o grupo muscular…",
  disabled = false,
  resetAfterSelect = false,
}: {
  label: string;
  options: SearchOption[];
  value?: string;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  resetAfterSelect?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.id === value);
  const matches = searchOptions(options, query);
  const shown = matches.slice(0, 6);
  const exact = options.some(
    (option) =>
      normalizeSearch(option.name).replace(/[\s-]/g, "") ===
      normalizeSearch(query).replace(/[\s-]/g, ""),
  );
  function choose(option: SearchOption) {
    onSelect(option.id);
    setQuery("");
    setOpen(false);
    setActive(0);
  }
  return (
    <div
      className="search-picker"
      ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="search-picker-input">
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + "-list"}
          aria-activedescendant={
            open && shown[active] ? id + "-option-" + active : undefined
          }
          value={open ? query : resetAfterSelect ? "" : (selected?.name ?? "")}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setQuery("");
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    shown.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && shown[active]) choose(shown[active]);
            }
          }}
        />
        {open && query && (
          <button
            type="button"
            className="search-clear"
            aria-label={"Limpiar " + label.toLocaleLowerCase()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setActive(0);
              root.current?.querySelector("input")?.focus();
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <div className="search-suggestions">
          <div
            id={id + "-list"}
            role="listbox"
            aria-label={"Sugerencias de " + label.toLocaleLowerCase()}
          >
            {shown.map((option, index) => (
              <button
                type="button"
                key={option.id}
                id={id + "-option-" + index}
                role="option"
                aria-selected={index === active}
                className="search-option"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>
                  <strong>{option.name}</strong>
                  {option.detail && <small>{option.detail}</small>}
                </span>
                {resetAfterSelect && <Plus size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {!matches.length && (
            <p className="search-empty">
              No encontramos coincidencias. Probá con otro nombre.
            </p>
          )}
          {matches.length > shown.length && (
            <p className="search-hint">
              Escribí un poco más para filtrar los {matches.length} resultados.
            </p>
          )}
          {onCreate && !exact && (
            <Button
              type="button"
              variant="ghost"
              className="full search-create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreate(query.trim());
                setOpen(false);
              }}
            >
              <Plus size={16} />
              {query.trim()
                ? "Crear “" + query.trim() + "”"
                : "Crear ejercicio nuevo"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
