import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ROOM_NAMES,
  type RoomName,
  type AirconSettings,
  type CurrentAirconSettings,
  type AirconReservation,
  type AirconState,
} from "./aircon-types";
import { normalizeMode, parseMode } from "./aircon-mode";

const SETTINGS_KEY = "aircon-settings-v1";
const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z";

const DEFAULT_SETTINGS: AirconSettings = {
  mode: "auto-steady",
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

const DEFAULT_CURRENT_SETTINGS: CurrentAirconSettings = {
  ...DEFAULT_SETTINGS,
  updatedAt: DEFAULT_UPDATED_AT,
};

let localFallback = structuredClone(DEFAULT_CURRENT_SETTINGS);
let localReservationsFallback: AirconReservation[] = [];

export function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.baseTemperature;
  }

  return Math.min(25, Math.max(18, Math.trunc(value)));
}

export function clampOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(2, Math.max(-2, Math.trunc(value)));
}

export function parseSettingsFromFormData(
  formData: FormData,
  fallbackRoomOffsets: AirconSettings["roomOffsets"],
): AirconSettings {
  const mode = parseMode(formData.get("mode"));
  const baseTemperature = clampTemperature(
    Number(formData.get("baseTemperature")),
  );

  const roomOffsets: AirconSettings["roomOffsets"] = { ...fallbackRoomOffsets };

  ROOM_NAMES.forEach((room) => {
    roomOffsets[room] = clampOffset(Number(formData.get(`room-${room}`)));
  });

  return {
    mode,
    baseTemperature,
    roomOffsets,
  };
}

function normalizeSettings(value: unknown): AirconSettings {
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

function normalizeUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_UPDATED_AT;
  }

  return Number.isNaN(Date.parse(value)) ? DEFAULT_UPDATED_AT : value;
}

function normalizeCurrentSettings(value: unknown): CurrentAirconSettings {
  const source = (value ?? {}) as { updatedAt?: unknown };
  const settings = normalizeSettings(value);

  return {
    ...settings,
    updatedAt: normalizeUpdatedAt(source.updatedAt),
  };
}

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") {
    return "00:00";
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return "00:00";
  }

  return value;
}

function normalizeReservation(value: unknown): AirconReservation | null {
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
      typeof source.lastAppliedDate === "string" ? source.lastAppliedDate : undefined,
  };
}

function normalizeState(value: unknown): AirconState {
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

function getKvBinding(): KVNamespace | undefined {
  try {
    const context = getCloudflareContext();
    return context.env.AC_SETTINGS_KV;
  } catch {
    return undefined;
  }
}



export async function getSettings(): Promise<CurrentAirconSettings> {
  return (await getAppState()).currentSettings;
}

export async function getReservations(): Promise<AirconReservation[]> {
  return (await getAppState()).reservations;
}

export async function getAppState(): Promise<AirconState> {
  const kv = getKvBinding();

  if (kv) {
    const raw = await kv.get(SETTINGS_KEY);
    if (!raw) {
      return {
        currentSettings: structuredClone(DEFAULT_CURRENT_SETTINGS),
        reservations: [],
      };
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch {
      return {
        currentSettings: structuredClone(DEFAULT_CURRENT_SETTINGS),
        reservations: [],
      };
    }
  }

  const localState: AirconState = {
    currentSettings: structuredClone(localFallback),
    reservations: structuredClone(localReservationsFallback),
  };

  return localState;
}

export async function saveSettings(nextSettings: AirconSettings): Promise<void> {
  const currentState = await getAppState();
  const normalized = normalizeSettings(nextSettings);
  const nextCurrentSettings: CurrentAirconSettings = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  const nextState: AirconState = {
    currentSettings: nextCurrentSettings,
    reservations: currentState.reservations,
  };
  const kv = getKvBinding();

  if (kv) {
    await kv.put(SETTINGS_KEY, JSON.stringify(nextState));
    return;
  }

  localFallback = nextCurrentSettings;
}

export async function saveReservations(nextReservations: AirconReservation[]): Promise<void> {
  const currentState = await getAppState();
  const normalizedReservations = nextReservations
    .map((reservation) => normalizeReservation(reservation))
    .filter((reservation): reservation is AirconReservation => reservation !== null);

  const nextState: AirconState = {
    currentSettings: currentState.currentSettings,
    reservations: normalizedReservations,
  };

  const kv = getKvBinding();

  if (kv) {
    await kv.put(SETTINGS_KEY, JSON.stringify(nextState));
    return;
  }

  localReservationsFallback = normalizedReservations;
}
