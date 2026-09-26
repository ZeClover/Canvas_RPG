import { describe, expect, it } from "vitest";
import { daysRemaining, defaultJourneyFields, defaultLeg, legsDone, readJourneyFields, totalDays } from "./journeyFields";

function leg(days: number, done = false) {
  return { ...defaultLeg(), days, done };
}

describe("journeyFields", () => {
  it("defaults to no legs and empty notes", () => {
    expect(defaultJourneyFields()).toEqual({ legs: [], supplyNote: "", encounterNote: "", log: [] });
  });

  it("totalDays sums every leg regardless of done state", () => {
    expect(totalDays([leg(2), leg(3, true), leg(1)])).toBe(6);
  });

  it("daysRemaining only sums legs not yet done", () => {
    expect(daysRemaining([leg(2), leg(3, true), leg(1)])).toBe(3);
  });

  it("legsDone counts only done legs", () => {
    expect(legsDone([leg(2), leg(3, true), leg(1, true)])).toBe(2);
  });

  it("readJourneyFields drops malformed legs but keeps valid ones", () => {
    const raw = { legs: [{ id: "l1", days: 2, done: true }, { fromEntityId: "x" }, "garbage"] };
    expect(readJourneyFields(raw).legs).toEqual([{ id: "l1", fromEntityId: null, toEntityId: null, distanceNote: "", days: 2, done: true }]);
  });

  it("falls back to defaults for a missing/malformed bag", () => {
    expect(readJourneyFields({})).toEqual(defaultJourneyFields());
  });
});
