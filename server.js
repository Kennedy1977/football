const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const compiledServer = path.resolve(__dirname, "dist/server.js");

function runBuildIfNeeded() {
  if (fs.existsSync(compiledServer)) {
    return;
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log("dist/server.js not found. Running `npm run build`...");

  const result = spawnSync(npmCmd, ["run", "build"], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0 || !fs.existsSync(compiledServer)) {
    console.error("Build failed. Verify Hostinger Node version (20+) and build logs.");
    process.exit(result.status || 1);
  }
}

runBuildIfNeeded();
require(compiledServer);
