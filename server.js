const fs = require("node:fs");
const path = require("node:path");

const compiledServer = path.resolve(__dirname, "dist/server.js");

if (!fs.existsSync(compiledServer)) {
  console.error(
    "dist/server.js not found. Run `npm run build` before starting production.",
  );
  process.exit(1);
}

require(compiledServer);
