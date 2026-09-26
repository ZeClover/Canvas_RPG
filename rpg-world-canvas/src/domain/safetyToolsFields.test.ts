import { describe, expect, it } from "vitest";
import { defaultSafetyToolsConfig, readSafetyToolsConfig } from "./safetyToolsFields";

describe("safetyToolsFields", () => {
  it("defaults to empty lines, veils and log", () => {
    expect(defaultSafetyToolsConfig()).toEqual({ linesAlways: [], veilsCareful: [], log: [] });
  });

  it("reads a well-formed config", () => {
    const raw = { linesAlways: ["dano a crianças"], veilsCareful: ["tortura"], log: [{ id: "l1", at: 5, note: "ajustado na sessão 3" }] };
    expect(readSafetyToolsConfig(raw)).toEqual(raw);
  });

  it("drops non-string entries from lines/veils", () => {
    const raw = { linesAlways: ["ok", 42, null], veilsCareful: [true, "ok2"] };
    expect(readSafetyToolsConfig(raw)).toMatchObject({ linesAlways: ["ok"], veilsCareful: ["ok2"] });
  });

  it("drops malformed log entries but keeps valid ones", () => {
    const raw = { log: [{ id: "l1", note: "ok" }, { note: "no id" }, "garbage"] };
    expect(readSafetyToolsConfig(raw).log).toHaveLength(1);
  });

  it("falls back to defaults for a missing/malformed config", () => {
    expect(readSafetyToolsConfig(undefined)).toEqual(defaultSafetyToolsConfig());
    expect(readSafetyToolsConfig("not an object")).toEqual(defaultSafetyToolsConfig());
  });
});
