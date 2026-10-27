import type { Exercise, Routine, RoutineItem } from "./model";

const exercise = (
  id: string,
  name: string,
  unit: Exercise["unit"],
  notes = "",
): Exercise => ({
  id: "mobility-15-" + id,
  name,
  group: "Movilidad y compresión",
  unit,
  load: "none",
  notes,
});
export const mobilityExercises: Exercise[] = [
  exercise(
    "wrists",
    "Muñecas · flexión, extensión y apoyos progresivos",
    "seconds",
  ),
  exercise("shoulders", "Hombros · rotaciones / CARs", "seconds"),
  exercise(
    "spine",
    "Cintura y columna · rotaciones, flexión y extensión",
    "seconds",
  ),
  exercise("hips", "Cadera · 90/90 o rotaciones", "seconds"),
  exercise("ankles", "Tobillos · knee-to-wall", "seconds"),
  exercise("pike-lifts", "Pike compression lifts", "reps"),
  exercise(
    "l-sit",
    "L-sit tuck / una pierna extendida",
    "seconds",
    "Elegí la variante tuck o con una pierna extendida.",
  ),
  exercise("straddle-lifts", "Straddle compression", "reps"),
  exercise("pike-stretch", "Pike stretch", "seconds"),
  exercise("straddle-stretch", "Straddle · flexibilidad", "seconds"),
  exercise(
    "shoulder-extension",
    "Extensión de hombros · flexibilidad",
    "seconds",
  ),
];
const item = (
  id: string,
  sets: number,
  target: string,
  block: string,
  rest = 0,
  notes = "",
): RoutineItem => ({
  id: "mobility-15-item-" + id,
  exerciseId: "mobility-15-" + id,
  sets,
  target,
  block,
  rest,
  notes,
  optional: false,
  circuit: "",
});
export const mobilityRoutine: Routine = {
  id: "routine-mobility-15",
  name: "Movilidad y compresiones · 15 min",
  category: "full",
  notes:
    "Entrada en calor/movilidad: 5 min. Compresiones de L: 7 min, foco principal. Flexibilidad: 3 min. Descansos cortos de 20–30 segundos en las compresiones; el temporizador empieza con 30 segundos, editables.",
  items: [
    ...["wrists", "shoulders", "spine", "hips", "ankles"].map((id) =>
      item(id, 1, "60 seg", "Entrada en calor / movilidad · 5 min"),
    ),
    item(
      "pike-lifts",
      3,
      "8–12 reps",
      "Compresiones de L · 7 min",
      30,
      "Descanso: 20–30 segundos.",
    ),
    item(
      "l-sit",
      3,
      "10–15 seg",
      "Compresiones de L · 7 min",
      30,
      "Descanso: 20–30 segundos.",
    ),
    item(
      "straddle-lifts",
      2,
      "8–12 reps",
      "Compresiones de L · 7 min",
      30,
      "Descanso: 20–30 segundos.",
    ),
    ...["pike-stretch", "straddle-stretch", "shoulder-extension"].map((id) =>
      item(id, 1, "60 seg", "Flexibilidad · 3 min"),
    ),
  ],
};
