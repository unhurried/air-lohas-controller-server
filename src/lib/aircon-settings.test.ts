import { describe, expect, it } from "vitest";
import { clampOffset, clampTemperature, normalizeState } from "./aircon-settings";

describe("clampTemperature", () => {
  it("clamps to the 16-30 range", () => {
    expect(clampTemperature(10)).toBe(16);
    expect(clampTemperature(40)).toBe(30);
    expect(clampTemperature(22.9)).toBe(22);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampTemperature(NaN)).toBe(22);
    expect(clampTemperature(Infinity)).toBe(22);
  });
});

describe("clampOffset", () => {
  it("clamps to the -2..2 range", () => {
    expect(clampOffset(-5)).toBe(-2);
    expect(clampOffset(5)).toBe(2);
    expect(clampOffset(1.9)).toBe(1);
  });

  it("falls back to 0 for non-finite input", () => {
    expect(clampOffset(NaN)).toBe(0);
  });
});

describe("normalizeState", () => {
  it("recovers a sane default state from malformed input", () => {
    const state = normalizeState({ garbage: true });
    expect(state.currentSettings.mode).toBe("auto-save");
    expect(state.reservations).toEqual([]);
  });

  it("drops reservations without a valid id", () => {
    const state = normalizeState({
      currentSettings: { mode: "cool", baseTemperature: 25 },
      reservations: [{ time: "09:00" }, { id: "keep-me", time: "10:00" }],
    });

    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0].id).toBe("keep-me");
  });

  it("normalizes an invalid reservation time to 00:00", () => {
    const state = normalizeState({
      reservations: [{ id: "a", time: "25:99" }],
    });

    expect(state.reservations[0].time).toBe("00:00");
  });

  it("treats a legacy top-level settings object (pre-reservations schema) as currentSettings", () => {
    const state = normalizeState({ mode: "heat", baseTemperature: 20 });
    expect(state.currentSettings.mode).toBe("heat");
    expect(state.currentSettings.baseTemperature).toBe(20);
    expect(state.reservations).toEqual([]);
  });
});
