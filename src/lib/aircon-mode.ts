import type { AirconMode } from "./aircon-types";

/**
 * Mode representation as stored in Cloudflare KV.
 * `"-"` corresponds to `"off"` (power off) in the application.
 */
export type KvAirconMode = "auto-steady" | "auto-save" | "-";

export const MODE_OPTIONS: ReadonlyArray<{ value: AirconMode; label: string }> = [
  { value: "off", label: "電源オフ" },
  { value: "auto-steady", label: "自動定常" },
  { value: "auto-save", label: "自動セーブ" },
];

const MODE_LABELS: Record<AirconMode, string> = {
  off: "電源オフ",
  "auto-steady": "自動定常",
  "auto-save": "自動セーブ",
};

/** Get the display label for a mode. */
export function getModeLabel(mode: AirconMode): string {
  return MODE_LABELS[mode];
}

/**
 * Normalize a mode value from any source (KV, form data, etc.) to an {@link AirconMode}.
 * Accepts both KV format (`"-"` for off) and app format (`"off"`).
 */
export function normalizeMode(value: unknown): AirconMode {
  if (value === "auto-save") return "auto-save";
  if (value === "-" || value === "off") return "off";
  return "auto-steady";
}

/** Convert an app mode to its KV representation. */
export function appModeToKvMode(appMode: AirconMode): KvAirconMode {
  if (appMode === "off") return "-";
  return appMode;
}

/** Parse a mode value from form data. */
export function parseMode(value: FormDataEntryValue | null): AirconMode {
  return normalizeMode(value);
}
