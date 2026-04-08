function getRandomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  if (typeof globalThis.crypto !== "undefined") globalThis.crypto.getRandomValues(b)
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256)
  return b
}
const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2,"0")).join("")
export const generateTraceId = () => toHex(getRandomBytes(16))
export const generateSpanId  = () => toHex(getRandomBytes(8))
export const isValidTraceId  = (id: string) => /^[0-9a-f]{32}$/.test(id) && id !== "0".repeat(32)
export const isValidSpanId   = (id: string) => /^[0-9a-f]{16}$/.test(id) && id !== "0".repeat(16)
export const hrTimeMs        = () => typeof performance !== "undefined"
  ? performance.timeOrigin + performance.now()
  : Date.now()