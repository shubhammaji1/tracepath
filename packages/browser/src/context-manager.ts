import { ROOT_CONTEXT } from "@tracepath/core"
import type { Context } from "@tracepath/core"
class BrowserContextManager {
  private _stack: Context[] = [ROOT_CONTEXT]
  active(): Context { return this._stack[this._stack.length - 1] ?? ROOT_CONTEXT }
  with<T>(ctx: Context, fn: () => T): T { this._stack.push(ctx); try { return fn() } finally { this._stack.pop() } }
}
export const contextManager = new BrowserContextManager()