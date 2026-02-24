import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

const SETTINGS_KEY = "aircon-settings-v1";

const DEFAULT_SETTINGS = {
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

const ROOM_NAMES = Object.keys(DEFAULT_SETTINGS.roomOffsets);

function clampTemperature(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.baseTemperature;
  }

  return Math.min(25, Math.max(18, Math.trunc(value)));
}

function clampOffset(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(2, Math.max(-2, Math.trunc(value)));
}

function normalizeSettings(value) {
  const source = value ?? {};

  const roomOffsets = ROOM_NAMES.reduce((result, room) => {
    result[room] = clampOffset(source.roomOffsets?.[room] ?? 0);
    return result;
  }, { ...DEFAULT_SETTINGS.roomOffsets });

  return {
    mode: source.mode === "auto-save" ? "auto-save" : "auto-steady",
    baseTemperature: clampTemperature(source.baseTemperature ?? 22),
    roomOffsets,
  };
}

function normalizeTime(value) {
  if (typeof value !== "string") {
    return "00:00";
  }

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "00:00";
}

function normalizeReservation(value) {
  const source = value ?? {};

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

function normalizeState(value) {
  const source = value ?? {};

  if (
    source.currentSettings === undefined &&
    source.reservations === undefined &&
    value !== null
  ) {
    return {
      currentSettings: normalizeSettings(value),
      reservations: [],
    };
  }

  const reservations = Array.isArray(source.reservations)
    ? source.reservations
        .map((reservation) => normalizeReservation(reservation))
        .filter((reservation) => reservation !== null)
    : [];

  return {
    currentSettings: normalizeSettings(source.currentSettings),
    reservations,
  };
}

function getJstDateTime(now) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const date = `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
  const time = `${map.get("hour")}:${map.get("minute")}`;

  return { date, time };
}

async function applyReservationsByCron(env) {
  const kv = env.AC_SETTINGS_KV;
  if (!kv) {
    return;
  }

  const raw = await kv.get(SETTINGS_KEY);
  if (!raw) {
    return;
  }

  const state = normalizeState(JSON.parse(raw));
  const { date: today, time: nowTime } = getJstDateTime(new Date());

  const dueReservations = state.reservations.filter(
    (reservation) =>
      reservation.enabled &&
      reservation.time <= nowTime &&
      reservation.lastAppliedDate !== today,
  );

  if (dueReservations.length === 0) {
    return;
  }

  const latest = [...dueReservations].sort((a, b) => a.time.localeCompare(b.time))[
    dueReservations.length - 1
  ];

  const nextReservations = state.reservations.map((reservation) => {
    if (dueReservations.some((due) => due.id === reservation.id)) {
      return {
        ...reservation,
        lastAppliedDate: today,
      };
    }

    return reservation;
  });

  await kv.put(
    SETTINGS_KEY,
    JSON.stringify({
      currentSettings: latest.settings,
      reservations: nextReservations,
    }),
  );
}

const worker = {
  fetch: openNextWorker.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(applyReservationsByCron(env));
  },
};

export default worker;
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };
