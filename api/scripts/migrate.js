const fs = require("fs");
const path = require("path");
const { createPool } = require("../db/pool");

async function main() {
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const pool = createPool();
  try {
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");
      await pool.query(sql);
      console.log("Applied:", file);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
