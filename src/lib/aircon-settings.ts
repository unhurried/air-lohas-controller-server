import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ROOM_NAMES,
  AC_STATE_SINGLETON,
  type AirconSettings,
  type CurrentAirconSettings,
  type AirconReservation,
  type AirconState,
} from "./aircon-types";
import { parseMode } from "./aircon-mode";
import {
  DEFAULT_CURRENT_SETTINGS,
  clampTemperature,
  clampOffset,
  normalizeSettings,
  normalizeReservation,
} from "./aircon-normalize";
import type { AirconStateDO } from "./aircon-state-do";

// 正規化・clamp 系の純粋関数は aircon-normalize.ts に移動した。
// 既存の import パス（テスト・呼び出し元）を維持するため同名で re-export する。
export {
  clampTemperature,
  clampOffset,
  normalizeState,
} from "./aircon-normalize";

let localFallback = structuredClone(DEFAULT_CURRENT_SETTINGS);
let localReservationsFallback: AirconReservation[] = [];

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

type AirconStateStub = DurableObjectStub<AirconStateDO>;

function getStateStub(): AirconStateStub | undefined {
  try {
    const context = getCloudflareContext();
    const namespace = context.env.AC_STATE;
    if (!namespace) {
      return undefined;
    }
    return namespace.get(namespace.idFromName(AC_STATE_SINGLETON));
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
  const stub = getStateStub();

  if (stub) {
    return stub.getState();
  }

  return {
    currentSettings: structuredClone(localFallback),
    reservations: structuredClone(localReservationsFallback),
  };
}

export async function saveSettings(nextSettings: AirconSettings): Promise<void> {
  const stub = getStateStub();

  if (stub) {
    await stub.saveSettings(nextSettings);
    return;
  }

  const normalized = normalizeSettings(nextSettings);
  localFallback = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveReservations(
  nextReservations: AirconReservation[],
): Promise<void> {
  const stub = getStateStub();

  if (stub) {
    await stub.saveReservations(nextReservations);
    return;
  }

  localReservationsFallback = nextReservations
    .map((reservation) => normalizeReservation(reservation))
    .filter(
      (reservation): reservation is AirconReservation => reservation !== null,
    );
}
