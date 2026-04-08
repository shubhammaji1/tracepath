import { defineConfig } from "tsup"
export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  format: ["esm"], dts: true, sourcemap: true, clean: true,
  target: "node18", platform: "node",
  esbuildOptions(o) { o.jsx = "transform"; o.jsxFactory = "React.createElement"; o.jsxFragment = "React.Fragment" },
})