const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const compiledServer = path.resolve(__dirname, "dist/server.js");
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map((part) => Number(part));

if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 9)) {
  console.error(
    `Node ${process.version} detected. This app requires Node >=20.9.0 (recommended: 22.x).`,
  );
  process.exit(1);
}

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

  if (result.error) {
    console.error(`Unable to run build command: ${result.error.message}`);
  }

  if (result.status !== 0 || !fs.existsSync(compiledServer)) {
    console.error(
      `Build failed (exit code: ${result.status ?? "unknown"}). Verify Node >=20.9.0 and Hostinger build logs.`,
    );
    process.exit(result.status || 1);
  }
}

runBuildIfNeeded();
require(compiledServer);
