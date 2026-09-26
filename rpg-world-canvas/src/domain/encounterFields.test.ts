import { describe, expect, it } from "vitest";
import {
  advanceTurn, currentCombatant, defaultCombatant, defaultEncounterFields,
  readEncounterFields, sortByInitiative, type EncounterFields,
} from "./encounterFields";

function withCombatants(initiatives: number[]): EncounterFields {
  const fields = defaultEncounterFields();
  fields.combatants = initiatives.map((initiative, i) => ({ ...defaultCombatant(`C${i}`), initiative }));
  return fields;
}

describe("encounterFields", () => {
  it("defaults to an empty, active, round-1 encounter", () => {
    const fields = defaultEncounterFields();
    expect(fields).toEqual({ active: true, round: 1, turnIndex: 0, combatants: [], log: [] });
  });

  it("sorts combatants by initiative descending, stable on ties", () => {
    const fields = withCombatants([5, 20, 20, 1]);
    const order = sortByInitiative(fields.combatants).map((c) => c.name);
    expect(order).toEqual(["C1", "C2", "C0", "C3"]);
  });

  it("currentCombatant follows initiative order, not insertion order", () => {
    const fields = withCombatants([5, 20]);
    expect(currentCombatant(fields)?.name).toBe("C1");
  });

  it("currentCombatant is null with no combatants", () => {
    expect(currentCombatant(defaultEncounterFields())).toBeNull();
  });

  it("advanceTurn cycles through initiative order and wraps into a new round", () => {
    let fields = withCombatants([20, 10, 5]);
    expect(currentCombatant(fields)?.name).toBe("C0");
    fields = advanceTurn(fields);
    expect(currentCombatant(fields)?.name).toBe("C1");
    expect(fields.round).toBe(1);
    fields = advanceTurn(fields);
    expect(currentCombatant(fields)?.name).toBe("C2");
    fields = advanceTurn(fields);
    expect(currentCombatant(fields)?.name).toBe("C0");
    expect(fields.round).toBe(2);
  });

  it("advanceTurn is a no-op with no combatants", () => {
    const fields = defaultEncounterFields();
    expect(advanceTurn(fields)).toBe(fields);
  });

  it("readEncounterFields clamps a stale turnIndex to the current combatant count", () => {
    const raw = { active: true, round: 3, turnIndex: 99, combatants: [defaultCombatant("Only")], log: [] };
    expect(readEncounterFields(raw).turnIndex).toBe(0);
  });

  it("readEncounterFields drops malformed combatant entries", () => {
    const raw = { combatants: [defaultCombatant("Ok"), { name: "no id" }, "garbage", 42] };
    expect(readEncounterFields(raw).combatants).toHaveLength(1);
  });

  it("readEncounterFields falls back to defaults for a missing/malformed bag", () => {
    expect(readEncounterFields({})).toEqual(defaultEncounterFields());
    expect(readEncounterFields({ round: -5, active: "yes" })).toMatchObject({ round: 1, active: true });
  });
});
