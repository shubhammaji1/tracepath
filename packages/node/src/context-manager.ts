import { AsyncLocalStorage } from "node:async_hooks"
import { ROOT_CONTEXT } from "@tracepath/core"
import type { Context } from "@tracepath/core"

class AsyncContextManager {
  private readonly _storage = new AsyncLocalStorage<Context>()
  active(): Context { return this._storage.getStore() ?? ROOT_CONTEXT }
  with<T>(context: Context, fn: () => T): T { return this._storage.run(context, fn) }
  bind<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const ctx = this.active()
    return ((...args: unknown[]) => this.with(ctx, () => fn(...args))) as T
  }
}
export const contextManager = new AsyncContextManager()