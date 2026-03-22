import type { AirconMode } from "./aircon-types";

export const MODE_OPTIONS: ReadonlyArray<{ value: AirconMode; label: string }> = [
  { value: "-", label: "電源オフ" },
  { value: "auto-steady", label: "自動定常" },
  { value: "auto-save", label: "自動セーブ" },
];

const MODE_LABELS: Record<AirconMode, string> = {
  "-": "電源オフ",
  "auto-steady": "自動定常",
  "auto-save": "自動セーブ",
};

/** Get the display label for a mode. */
export function getModeLabel(mode: AirconMode): string {
  return MODE_LABELS[mode];
}

/** Normalize a mode value from any source (KV, form data, etc.) to an {@link AirconMode}. */
export function normalizeMode(value: unknown): AirconMode {
  if (value === "auto-save") return "auto-save";
  if (value === "-") return "-";
  return "auto-steady";
}

/** Parse a mode value from form data. */
export function parseMode(value: FormDataEntryValue | null): AirconMode {
  return normalizeMode(value);
}
