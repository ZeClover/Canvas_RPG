// Installs a real (in-memory) IndexedDB implementation for tests, so
// repository.ts and db.ts run their actual code paths instead of being
// mocked away.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { resetDatabaseForTests } from "../data/db";

export function resetIndexedDb(): void {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetDatabaseForTests();
}
