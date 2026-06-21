/*
 * Catalog mirror of the design tokens defined in styles.css (@theme).
 * styles.css is the source of truth; this file exists so the /design-system
 * page can enumerate tokens with their values and usage notes. Keep in sync.
 */

export interface ColorToken {
  name: string;
  /** the Tailwind color key, e.g. `surface` → bg-surface / text-surface */
  key: string;
  value: string;
  usage: string;
}

export const colorTokens: ColorToken[] = [
  { name: "Background", key: "bg", value: "#0a0b0d", usage: "Page canvas" },
  {
    name: "Surface",
    key: "surface",
    value: "#101216",
    usage: "Panels, inputs",
  },
  {
    name: "Surface 2",
    key: "surface-2",
    value: "#15181d",
    usage: "Raised / hover layer",
  },
  {
    name: "Line",
    key: "line",
    value: "#1d2127",
    usage: "Borders, hairline dividers",
  },
  { name: "Ink", key: "ink", value: "#e6e9ed", usage: "Primary text & values" },
  {
    name: "Muted",
    key: "muted",
    value: "#7b828c",
    usage: "Labels, secondary text",
  },
  {
    name: "Brand",
    key: "brand",
    value: "#c8fa54",
    usage: "Primary action, active state, selected route",
  },
  { name: "Up", key: "up", value: "#26d07c", usage: "Positive / gains" },
  { name: "Down", key: "down", value: "#ff5470", usage: "Negative / losses" },
];

export interface TypeToken {
  name: string;
  className: string;
  note: string;
}

export const typeScale: TypeToken[] = [
  {
    name: "Display",
    className: "text-2xl text-ink tabular-nums",
    note: "Amount inputs, headline values",
  },
  {
    name: "Title",
    className: "text-sm font-bold text-white",
    note: "Pair labels, panel headings",
  },
  {
    name: "Body",
    className: "text-[0.8125rem] text-ink",
    note: "Default reading size",
  },
  {
    name: "Data",
    className: "text-[0.72rem] tabular-nums text-ink",
    note: "Tables, ledgers",
  },
  {
    name: "Label",
    className: "text-[0.65rem] tracking-widest text-muted uppercase",
    note: "Field & column labels",
  },
];
