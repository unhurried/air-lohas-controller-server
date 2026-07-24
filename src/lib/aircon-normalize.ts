import {
  ROOM_NAMES,
  type RoomName,
  type AirconSettings,
  type CurrentAirconSettings,
  type AirconReservation,
  type AirconState,
} from "./aircon-types";
import { normalizeMode } from "./aircon-mode";

export const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z";

export const DEFAULT_SETTINGS: AirconSettings = {
  mode: "auto-save",
  baseTemperature: 22,
  roomOffsets: {
    リビング: 0,
    寝室: 0,
    書斎: 0,
    玄関: 0,
    洗面室: 0,
    子供部屋1: 0,
    子供部屋2: 0,
    ホール2: 0,
  },
};

export const DEFAULT_CURRENT_SETTINGS: CurrentAirconSettings = {
  ...DEFAULT_SETTINGS,
  updatedAt: DEFAULT_UPDATED_AT,
};

export function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.baseTemperature;
  }

  return Math.min(30, Math.max(16, Math.trunc(value)));
}

export function clampOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(2, Math.max(-2, Math.trunc(value)));
}

export function normalizeSettings(value: unknown): AirconSettings {
  const source = (value ?? {}) as Partial<AirconSettings>;

  const normalizedMode = normalizeMode(source.mode);

  const normalizedRoomOffsets = ROOM_NAMES.reduce<Record<RoomName, number>>(
    (result, room) => {
      result[room] = clampOffset(source.roomOffsets?.[room] ?? 0);
      return result;
    },
    { ...DEFAULT_SETTINGS.roomOffsets },
  );

  return {
    mode: normalizedMode,
    baseTemperature: clampTemperature(source.baseTemperature ?? 22),
    roomOffsets: normalizedRoomOffsets,
  };
}

export function normalizeUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_UPDATED_AT;
  }

  return Number.isNaN(Date.parse(value)) ? DEFAULT_UPDATED_AT : value;
}

export function normalizeCurrentSettings(value: unknown): CurrentAirconSettings {
  const source = (value ?? {}) as { updatedAt?: unknown };
  const settings = normalizeSettings(value);

  return {
    ...settings,
    updatedAt: normalizeUpdatedAt(source.updatedAt),
  };
}

export function normalizeTime(value: unknown): string {
  if (typeof value !== "string") {
    return "00:00";
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return "00:00";
  }

  return value;
}

export function normalizeReservation(value: unknown): AirconReservation | null {
  const source = (value ?? {}) as Partial<AirconReservation>;

  if (!source.id || typeof source.id !== "string") {
    return null;
  }

  return {
    id: source.id,
    time: normalizeTime(source.time),
    enabled: source.enabled !== false,
    settings: normalizeSettings(source.settings),
    lastAppliedDate:
      typeof source.lastAppliedDate === "string"
        ? source.lastAppliedDate
        : undefined,
  };
}

export function normalizeState(value: unknown): AirconState {
  const source = (value ?? {}) as {
    currentSettings?: unknown;
    reservations?: unknown;
  };

  if (
    source.currentSettings === undefined &&
    source.reservations === undefined &&
    value !== null
  ) {
    return {
      currentSettings: normalizeCurrentSettings(value),
      reservations: [],
    };
  }

  const reservationsSource = Array.isArray(source.reservations)
    ? source.reservations
    : [];

  return {
    currentSettings: normalizeCurrentSettings(source.currentSettings),
    reservations: reservationsSource
      .map((item) => normalizeReservation(item))
      .filter((item): item is AirconReservation => item !== null),
  };
}
