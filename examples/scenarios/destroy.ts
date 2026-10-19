/** Destroy every object that exposes `destroy`. */
export function destroyAll(objects: Iterable<{ destroy(): void }>) {
  for (const o of objects) o.destroy()
}
