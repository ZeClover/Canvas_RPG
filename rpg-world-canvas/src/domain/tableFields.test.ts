import { describe, expect, it } from "vitest";
import { defaultEntry, defaultTableFields, readTableFields, rollTable } from "./tableFields";

describe("tableFields", () => {
  it("defaults to no entries and no history", () => {
    expect(defaultTableFields()).toEqual({ entries: [], history: [] });
  });

  it("defaultEntry clamps a negative weight to 0", () => {
    expect(defaultEntry("Goblin", -3).weight).toBe(0);
    expect(defaultEntry("Goblin", 5).weight).toBe(5);
  });

  it("rollTable returns null with no entries", () => {
    expect(rollTable([])).toBeNull();
  });

  it("rollTable returns null when every entry has weight 0", () => {
    const entries = [defaultEntry("A", 0), defaultEntry("B", 0)];
    expect(rollTable(entries)).toBeNull();
  });

  it("rollTable picks deterministically by cumulative weight", () => {
    const a = defaultEntry("A", 1);
    const b = defaultEntry("B", 3);
    const entries = [a, b]; // total weight 4: [0,1) -> A, [1,4) -> B
    expect(rollTable(entries, () => 0)?.id).toBe(a.id);
    expect(rollTable(entries, () => 0.2)?.id).toBe(a.id); // target 0.8, within A's [0,1)
    expect(rollTable(entries, () => 0.3)?.id).toBe(b.id); // target 1.2, within B's [1,4)
    expect(rollTable(entries, () => 0.99)?.id).toBe(b.id);
  });

  it("rollTable skips zero-weight entries entirely", () => {
    const zero = defaultEntry("Never", 0);
    const always = defaultEntry("Always", 1);
    const entries = [zero, always];
    for (let i = 0; i < 20; i++) expect(rollTable(entries, () => i / 20)?.id).toBe(always.id);
  });

  it("readTableFields drops malformed entries and rolls but keeps valid ones", () => {
    const raw = {
      entries: [{ id: "e1", text: "Ok", weight: 2 }, { text: "no id" }, "garbage"],
      history: [{ id: "h1", at: 1, result: "Ok" }, { id: "h2" }, 42],
    };
    const fields = readTableFields(raw);
    expect(fields.entries).toEqual([{ id: "e1", text: "Ok", weight: 2 }]);
    expect(fields.history).toEqual([{ id: "h1", at: 1, result: "Ok" }]);
  });

  it("falls back to defaults for a missing/malformed bag", () => {
    expect(readTableFields({})).toEqual(defaultTableFields());
  });
});
