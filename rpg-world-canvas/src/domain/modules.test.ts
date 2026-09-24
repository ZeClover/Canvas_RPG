import { describe, expect, it } from "vitest";
import { ALL_MODULE_KEYS, defaultEnabledModules, isKindSectionEnabled, isModuleKey, MODULE_FOR_KIND, MODULE_REGISTRY } from "./modules";

describe("modules: registro e chaves", () => {
  it("todo módulo do registro tem uma chave única reconhecida por isModuleKey", () => {
    const keys = MODULE_REGISTRY.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(isModuleKey(key)).toBe(true);
  });

  it("isModuleKey rejeita uma string desconhecida", () => {
    expect(isModuleKey("modulo_inventado")).toBe(false);
  });

  it("defaultEnabledModules liga tudo — uma campanha nova ou antiga nunca perde uma ferramenta sem escolher", () => {
    expect(defaultEnabledModules().sort()).toEqual([...ALL_MODULE_KEYS].sort());
  });
});

describe("modules: isKindSectionEnabled", () => {
  it("um tipo sem módulo dono (ex.: location) está sempre liberado", () => {
    expect(isKindSectionEnabled("location", [])).toBe(true);
  });

  it("um tipo com módulo dono só é liberado se o módulo estiver na lista habilitada", () => {
    expect(isKindSectionEnabled("npc", [])).toBe(false);
    expect(isKindSectionEnabled("npc", ["npc_brain"])).toBe(true);
  });

  it("todo tipo listado em MODULE_FOR_KIND aponta para uma chave de módulo válida", () => {
    for (const moduleKey of Object.values(MODULE_FOR_KIND)) {
      expect(isModuleKey(moduleKey!)).toBe(true);
    }
  });
});
