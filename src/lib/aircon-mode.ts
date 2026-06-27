import type { AirconMode } from "./aircon-types";

export const MODE_OPTIONS: ReadonlyArray<{ value: AirconMode; label: string }> = [
  { value: "-", label: "停止" },
  { value: "auto-save", label: "セーブ" },
  { value: "heat", label: "暖房" },
  { value: "cool", label: "冷房" },
];

const MODE_LABELS: Record<AirconMode, string> = {
  "-": "停止",
  "auto-save": "セーブ",
  heat: "暖房",
  cool: "冷房",
};

/** Get the display label for a mode. */
export function getModeLabel(mode: AirconMode): string {
  return MODE_LABELS[mode];
}

/** Normalize a mode value from any source (KV, form data, etc.) to an {@link AirconMode}. */
export function normalizeMode(value: unknown): AirconMode {
  if (value === "cool") return "cool";
  if (value === "heat") return "heat";
  if (value === "auto-save") return "auto-save";
  if (value === "-") return "-";
  return "auto-save";
}

/** Parse a mode value from form data. */
export function parseMode(value: FormDataEntryValue | null): AirconMode {
  return normalizeMode(value);
}
