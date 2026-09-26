import { describe, expect, it } from "vitest";
import { defaultClock, defaultFactionFields, readFactionFields, setClockFilled } from "./factionFields";

describe("factionFields", () => {
  it("defaults to standing 0 and no clocks", () => {
    expect(defaultFactionFields()).toEqual({ goal: "", resources: "", standing: 0, clocks: [], log: [] });
  });

  it("defaultClock falls back to 6 segments for an invalid option", () => {
    expect(defaultClock("Invasão", 7)).toMatchObject({ label: "Invasão", segments: 6, filled: 0 });
    expect(defaultClock("Cerco", 8)).toMatchObject({ segments: 8 });
  });

  it("setClockFilled clamps to [0, segments]", () => {
    const clock = defaultClock("X", 4);
    expect(setClockFilled(clock, 2).filled).toBe(2);
    expect(setClockFilled(clock, 99).filled).toBe(4);
    expect(setClockFilled(clock, -5).filled).toBe(0);
  });

  it("readFactionFields clamps standing to [-100, 100]", () => {
    expect(readFactionFields({ standing: 500 }).standing).toBe(100);
    expect(readFactionFields({ standing: -500 }).standing).toBe(-100);
    expect(readFactionFields({}).standing).toBe(0);
  });

  it("readFactionFields clamps a clock's stale filled value to its segment count", () => {
    const raw = { clocks: [{ id: "c1", label: "X", segments: 4, filled: 99 }] };
    expect(readFactionFields(raw).clocks[0].filled).toBe(4);
  });

  it("readFactionFields drops malformed clock entries", () => {
    const raw = { clocks: [{ id: "c1", label: "Ok", segments: 6, filled: 2 }, { label: "no id" }, "garbage"] };
    expect(readFactionFields(raw).clocks).toHaveLength(1);
  });

  it("falls back to defaults for a missing/malformed bag", () => {
    expect(readFactionFields({})).toEqual(defaultFactionFields());
  });
});
