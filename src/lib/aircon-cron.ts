import type { AirconReservation, AirconState } from "./aircon-types";

export function getJstDateTime(now: Date): { date: string; time: string } {
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

export type CronApplication = {
  nextState: AirconState;
  applied: AirconReservation;
  dueCount: number;
};

/**
 * Pure decision logic for the Cloudflare Workers cron trigger (see worker.mjs).
 * Given the current state and "now", determines which reservation (if any) is due
 * and returns the updated state to persist. Kept free of KV/Cloudflare APIs so it
 * can run identically in the worker and in unit tests.
 */
export function applyDueReservation(
  state: AirconState,
  now: Date,
): CronApplication | null {
  const { date: today, time: nowTime } = getJstDateTime(now);

  const dueReservations = state.reservations.filter(
    (reservation) =>
      reservation.enabled &&
      reservation.time <= nowTime &&
      reservation.lastAppliedDate !== today,
  );

  if (dueReservations.length === 0) {
    return null;
  }

  const applied = [...dueReservations].sort((a, b) =>
    a.time.localeCompare(b.time),
  )[dueReservations.length - 1];

  const nextReservations = state.reservations.map((reservation) => {
    if (dueReservations.some((due) => due.id === reservation.id)) {
      return {
        ...reservation,
        lastAppliedDate: today,
      };
    }

    return reservation;
  });

  const nextState: AirconState = {
    currentSettings: {
      ...applied.settings,
      updatedAt: now.toISOString(),
    },
    reservations: nextReservations,
  };

  return { nextState, applied, dueCount: dueReservations.length };
}
