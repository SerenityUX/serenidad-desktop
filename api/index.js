require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createPool } = require("./db/pool");
const createAuthRouter = require("./routes/auth");
const createRequireAuth = require("./middleware/requireAuth");
const createProjectsRouter = require("./routes/projects");
const createVoiceRouter = require("./routes/voice");
const createBillingRouter = require("./routes/billing");
const createAnalyticsRouter = require("./routes/analytics");
const createLogRequest = require("./middleware/logRequest");
const desktopVersion = require("./desktopVersion");

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
  app.use(cors());

  // Stripe webhook MUST receive the raw request body so we can verify its
  // signature — mount it BEFORE express.json so the parser doesn't consume
  // the bytes Stripe signed.
  if (dbOk) {
    app.use("/billing", createBillingRouter(pool));
  }

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.type("text/plain").send(dbOk ? "db connected" : "db failed");
  });

  app.get("/desktop-version", (_req, res) => {
    res.json(desktopVersion);
  });

  if (dbOk) {
    const requireAuth = createRequireAuth(pool);
    const logRequest = createLogRequest(pool);
    // Log every authenticated request for the analytics dashboard. Mounting
    // logger BEFORE the routers (with requireAuth running per-route) means
    // unauth'd requests get a NULL user_id but still appear in the log,
    // which is what we want for traffic visibility.
    app.use(logRequest);
    app.use("/auth", createAuthRouter(pool, requireAuth));
    app.use("/projects", createProjectsRouter(pool, requireAuth));
    app.use("/voice", createVoiceRouter(pool, requireAuth));
    app.use("/analytics", createAnalyticsRouter(pool, requireAuth));
  }

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    const keyStatus = (name) => {
      const v = String(process.env[name] || "").trim();
      if (!v || v === "undefined") return "MISSING";
      return `ok (len=${v.length})`;
    };
    console.log(
      `[voice] keys: GROQ_API_KEY=${keyStatus("GROQ_API_KEY")}, OPEN_ROUTER_API_TOKEN=${keyStatus("OPEN_ROUTER_API_TOKEN")}, FAL_API_KEY=${keyStatus("FAL_API_KEY")}`,
    );
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
