let counter = 0;

/** Stable, readable, collision-safe id. Never derived from a title, so
 * renaming anything never breaks a relation or a group membership. */
export function createId(prefix: string): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
