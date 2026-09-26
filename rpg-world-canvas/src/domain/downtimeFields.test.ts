import { describe, expect, it } from "vitest";
import { defaultDowntimeFields, downtimeProgress, readDowntimeFields, type DowntimeFields } from "./downtimeFields";

function fields(overrides: Partial<DowntimeFields>): DowntimeFields {
  return { ...defaultDowntimeFields(), ...overrides };
}

describe("downtimeFields", () => {
  it("defaults to 1 day needed, 0 spent, no character linked", () => {
    expect(defaultDowntimeFields()).toEqual({ characterEntityId: null, activity: "", daysNeeded: 1, daysSpent: 0, outcomeNote: "", log: [] });
  });

  it("downtimeProgress computes percent and complete from spent/needed", () => {
    expect(downtimeProgress(fields({ daysNeeded: 10, daysSpent: 3 }))).toEqual({ percent: 30, complete: false });
    expect(downtimeProgress(fields({ daysNeeded: 10, daysSpent: 10 }))).toEqual({ percent: 100, complete: true });
  });

  it("downtimeProgress caps percent at 100 even when spent overshoots needed", () => {
    expect(downtimeProgress(fields({ daysNeeded: 5, daysSpent: 9 }))).toEqual({ percent: 100, complete: true });
  });

  it("downtimeProgress treats a 0-day activity as already complete", () => {
    expect(downtimeProgress(fields({ daysNeeded: 0, daysSpent: 0 }))).toEqual({ percent: 100, complete: true });
  });

  it("readDowntimeFields falls back to defaults for a missing/malformed bag", () => {
    expect(readDowntimeFields({})).toEqual(defaultDowntimeFields());
    expect(readDowntimeFields({ daysNeeded: -5, daysSpent: -1 })).toMatchObject({ daysNeeded: 1, daysSpent: 0 });
  });

  it("readDowntimeFields drops malformed log entries but keeps valid ones", () => {
    const raw = { log: [{ id: "l1", note: "ok" }, { note: "no id" }, "garbage"] };
    expect(readDowntimeFields(raw).log).toHaveLength(1);
  });
});
