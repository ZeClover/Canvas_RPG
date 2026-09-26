import { describe, expect, it } from "vitest";
import { defaultAttribute, defaultCharacterFields, readCharacterFields } from "./characterFields";

describe("characterFields", () => {
  it("defaults to hp 10/10 and no attributes", () => {
    expect(defaultCharacterFields()).toEqual({ hp: 10, maxHp: 10, level: "", attributes: [], conditions: [], notes: "" });
  });

  it("defaultAttribute creates a fresh id per call", () => {
    const a = defaultAttribute("Força", "16");
    const b = defaultAttribute("Força", "16");
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ label: "Força", value: "16" });
  });

  it("reads a full, well-formed fields bag", () => {
    const raw = {
      hp: 24, maxHp: 30, level: "5", conditions: ["envenenado"], notes: "cansado",
      attributes: [{ id: "a1", label: "Vigor", value: "d8" }],
    };
    expect(readCharacterFields(raw)).toEqual({
      hp: 24, maxHp: 30, level: "5", conditions: ["envenenado"], notes: "cansado",
      attributes: [{ id: "a1", label: "Vigor", value: "d8" }],
    });
  });

  it("drops malformed attribute entries but keeps valid ones", () => {
    const raw = { attributes: [{ id: "a1", label: "Ok", value: "1" }, { label: "no id" }, "garbage", 42] };
    expect(readCharacterFields(raw).attributes).toEqual([{ id: "a1", label: "Ok", value: "1" }]);
  });

  it("falls back to defaults for a missing/malformed bag", () => {
    expect(readCharacterFields({})).toEqual(defaultCharacterFields());
    expect(readCharacterFields({ hp: "lots", level: 5 })).toMatchObject({ hp: 10, level: "" });
  });
});
