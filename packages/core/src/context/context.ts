import type { Context } from "../types/context.js"
export class ImmutableContext implements Context {
  private readonly _map: Map<symbol, unknown>
  constructor(map?: Map<symbol, unknown>) { this._map = new Map(map) }
  getValue(key: symbol): unknown { return this._map.get(key) }
  setValue(key: symbol, value: unknown): Context {
    const m = new Map(this._map); m.set(key, value); return new ImmutableContext(m)
  }
  deleteValue(key: symbol): Context {
    const m = new Map(this._map); m.delete(key); return new ImmutableContext(m)
  }
}
export const ROOT_CONTEXT: Context = new ImmutableContext()