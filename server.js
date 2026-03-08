require("dotenv").config({ quiet: true });

const express = require("express");
const { checkDatabaseConnection } = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const verifyDbOnStartup = process.env.VERIFY_DB_ON_STARTUP === "true";

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send("<!doctype html><html><body><h1>Coming soon...</h1></body></html>");
});

app.get("/health/db", async (_req, res) => {
  try {
    await checkDatabaseConnection();
    return res.status(200).json({ ok: true, message: "MySQL connected" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "MySQL connection failed",
      error: error.message,
    });
  }
});

async function startServer() {
  if (verifyDbOnStartup) {
    try {
      await checkDatabaseConnection();
      console.log("MySQL connection established.");
    } catch (error) {
      console.error("MySQL connection failed on startup:", error.message);
    }
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
