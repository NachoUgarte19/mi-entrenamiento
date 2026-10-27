export type SearchOption = { id: string; name: string; detail?: string };
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");
}
export function searchOptions(options: SearchOption[], query: string) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  return options
    .filter((option) => {
      const text = normalizeSearch(option.name + " " + (option.detail ?? ""));
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      const term = normalizeSearch(query);
      const rank = (option: SearchOption) =>
        normalizeSearch(option.name) === term
          ? 0
          : normalizeSearch(option.name).startsWith(term)
            ? 1
            : 2;
      return rank(a) - rank(b) || a.name.localeCompare(b.name, "es");
    });
}
