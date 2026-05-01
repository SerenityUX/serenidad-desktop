require("dotenv").config();

const express = require("express");
const { createPool } = require("./db/pool");
const createAuthRouter = require("./routes/auth");
const createRequireAuth = require("./middleware/requireAuth");
const createProjectsRouter = require("./routes/projects");

const port = Number(process.env.PORT) || 3000;

async function main() {
  const pool = createPool();

  let dbOk = false;
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.type("text/plain").send(dbOk ? "db connected" : "db failed");
  });

  if (dbOk) {
    app.use("/auth", createAuthRouter(pool));
    const requireAuth = createRequireAuth(pool);
    app.use("/projects", createProjectsRouter(pool, requireAuth));
  }

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
