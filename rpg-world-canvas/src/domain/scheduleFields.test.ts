import { describe, expect, it } from "vitest";
import { defaultScheduleEntry, defaultScheduleFields, readScheduleFields } from "./scheduleFields";

describe("scheduleFields", () => {
  it("defaults to no entries", () => {
    expect(defaultScheduleFields()).toEqual({ entries: [] });
  });

  it("defaultScheduleEntry creates a fresh id per call", () => {
    const a = defaultScheduleEntry("Manhãs", "loc1");
    const b = defaultScheduleEntry("Manhãs", "loc1");
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ label: "Manhãs", locationEntityId: "loc1", note: "" });
  });

  it("reads the schedule key without touching any other key in the same fields bag", () => {
    const raw = { traits: ["curioso"], schedule: [{ id: "s1", label: "Manhãs", locationEntityId: "loc1", note: "na biblioteca" }] };
    expect(readScheduleFields(raw)).toEqual({ entries: [{ id: "s1", label: "Manhãs", locationEntityId: "loc1", note: "na biblioteca" }] });
  });

  it("drops malformed entries but keeps valid ones", () => {
    const raw = { schedule: [{ id: "s1", label: "Ok" }, { label: "no id" }, "garbage"] };
    expect(readScheduleFields(raw).entries).toEqual([{ id: "s1", label: "Ok", locationEntityId: null, note: "" }]);
  });

  it("falls back to an empty list for a missing/malformed bag", () => {
    expect(readScheduleFields({})).toEqual({ entries: [] });
    expect(readScheduleFields({ schedule: "not an array" })).toEqual({ entries: [] });
  });
});
