// init() MUST be the first import so http patching happens before express loads
import { init, getTracer, tracepathMiddleware } from "@tracepath/node"
const tracer = init({ service: "express-example", version: "1.0.0", dashboard: true })

import express from "express"
const app = express()
app.use(express.json())
app.use(tracepathMiddleware(tracer))

const users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob",   email: "bob@example.com" },
]

app.get("/users", async (_req, res) => {
  const result = await getTracer().startActiveSpan("db.findAllUsers", async (span) => {
    span.setAttributes({ "db.system": "postgresql", "db.operation": "SELECT" })
    await new Promise(r => setTimeout(r, 20 + Math.random() * 50))
    span.setAttribute("db.rows_returned", users.length)
    return users
  })
  res.json(result)
})

app.get("/users/:id", async (req, res) => {
  const user = await getTracer().startActiveSpan("db.findUser", async (span) => {
    span.setAttribute("user.id", req.params.id ?? "")
    await new Promise(r => setTimeout(r, 10 + Math.random() * 30))
    return users.find(u => String(u.id) === req.params.id)
  })
  if (!user) return res.status(404).json({ error: "Not found" })
  res.json(user)
})

app.get("/slow", async (_req, res) => {
  await getTracer().startActiveSpan("slow.operation", async (span) => {
    span.setAttribute("reason", "simulated slow query")
    await new Promise(r => setTimeout(r, 600))
  })
  res.json({ message: "finally done" })
})

app.get("/error", (_req, res) => {
  getTracer().startActiveSpan("failing.operation", (span) => {
    try { throw new Error("Simulated failure") }
    catch (err) { span.recordException(err); span.end(); res.status(500).json({ error: err.message }) }
  })
})

app.listen(3000, () => {
  console.log("Server â†’ http://localhost:3000")
  console.log("Dashboard â†’ npx @tracepath/cli dashboard  (in a separate terminal)")
})