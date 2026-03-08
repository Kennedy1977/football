const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const compiledServer = path.resolve(__dirname, "dist/server.js");
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map((part) => Number(part));

if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 9)) {
  console.error(
    `Node ${process.version} detected. This app requires Node >=20.9.0 (recommended: 22.x).`,
  );
  process.exit(1);
}

function runBuildStep(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`${label} failed to launch: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}.`);
    process.exit(result.status || 1);
  }
}

function runBuildIfNeeded() {
  if (fs.existsSync(compiledServer)) {
    return;
  }

  console.log("dist/server.js not found. Running build from local binaries...");

  let nextBin;
  let tscBin;

  try {
    nextBin = require.resolve("next/dist/bin/next");
    tscBin = require.resolve("typescript/bin/tsc");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown resolution error";
    console.error(`Build dependencies missing: ${message}`);
    console.error("Ensure deploy installs devDependencies, or run build before start.");
    process.exit(1);
  }

  runBuildStep("Next build", [nextBin, "build", "apps/web"]);
  runBuildStep("Server TypeScript build", [tscBin, "-p", "tsconfig.server.json"]);

  if (!fs.existsSync(compiledServer)) {
    console.error("Build completed but dist/server.js is still missing.");
    process.exit(1);
  }
}

runBuildIfNeeded();
require(compiledServer);
