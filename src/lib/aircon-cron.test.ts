import { describe, expect, it } from "vitest";
import { applyDueReservation, getJstDateTime } from "./aircon-cron";
import type { AirconReservation, AirconState } from "./aircon-types";

function makeReservation(
  overrides: Partial<AirconReservation> & Pick<AirconReservation, "id" | "time">,
): AirconReservation {
  return {
    enabled: true,
    settings: {
      mode: "cool",
      baseTemperature: 25,
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
    },
    ...overrides,
  };
}

function makeState(reservations: AirconReservation[]): AirconState {
  return {
    currentSettings: {
      mode: "-",
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
      updatedAt: "1970-01-01T00:00:00.000Z",
    },
    reservations,
  };
}

// 2026-07-19T01:30:00Z is 2026-07-19 10:30 JST.
const NOW = new Date("2026-07-19T01:30:00.000Z");

describe("getJstDateTime", () => {
  it("converts UTC to JST date/time parts", () => {
    expect(getJstDateTime(NOW)).toEqual({ date: "2026-07-19", time: "10:30" });
  });
});

describe("applyDueReservation", () => {
  it("returns null when no reservation is due", () => {
    const state = makeState([makeReservation({ id: "a", time: "11:00" })]);
    expect(applyDueReservation(state, NOW)).toBeNull();
  });

  it("returns null when the due reservation is disabled", () => {
    const state = makeState([
      makeReservation({ id: "a", time: "09:00", enabled: false }),
    ]);
    expect(applyDueReservation(state, NOW)).toBeNull();
  });

  it("returns null when the reservation already applied today", () => {
    const state = makeState([
      makeReservation({ id: "a", time: "09:00", lastAppliedDate: "2026-07-19" }),
    ]);
    expect(applyDueReservation(state, NOW)).toBeNull();
  });

  it("applies a reservation whose time already passed but was applied on a previous day", () => {
    const state = makeState([
      makeReservation({ id: "a", time: "09:00", lastAppliedDate: "2026-07-18" }),
    ]);
    const result = applyDueReservation(state, NOW);
    expect(result?.applied.id).toBe("a");
    expect(result?.nextState.reservations[0].lastAppliedDate).toBe("2026-07-19");
  });

  it("picks the latest of multiple due reservations and marks all of them applied", () => {
    const state = makeState([
      makeReservation({ id: "early", time: "08:00" }),
      makeReservation({ id: "late", time: "10:00" }),
    ]);
    const result = applyDueReservation(state, NOW);

    expect(result?.applied.id).toBe("late");
    expect(result?.dueCount).toBe(2);
    expect(
      result?.nextState.reservations.every(
        (reservation) => reservation.lastAppliedDate === "2026-07-19",
      ),
    ).toBe(true);
  });

  it("ignores reservations scheduled later today", () => {
    const state = makeState([makeReservation({ id: "a", time: "23:00" })]);
    expect(applyDueReservation(state, NOW)).toBeNull();
  });

  it("carries the applied reservation's settings into currentSettings with a fresh updatedAt", () => {
    const state = makeState([
      makeReservation({
        id: "a",
        time: "09:00",
        settings: {
          mode: "heat",
          baseTemperature: 20,
          roomOffsets: {
            リビング: 1,
            寝室: 0,
            書斎: 0,
            玄関: 0,
            洗面室: 0,
            子供部屋1: 0,
            子供部屋2: 0,
            ホール2: 0,
          },
        },
      }),
    ]);

    const result = applyDueReservation(state, NOW);

    expect(result?.nextState.currentSettings).toMatchObject({
      mode: "heat",
      baseTemperature: 20,
    });
    expect(result?.nextState.currentSettings.updatedAt).toBe(NOW.toISOString());
  });
});
