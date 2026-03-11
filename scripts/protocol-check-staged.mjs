import { execSync } from "node:child_process";

if (process.env.SKIP_PROTOCOL_CHECK === "1") {
  process.exit(0);
}

const stagedFiles = getStagedFiles();
if (!stagedFiles.length) {
  process.exit(0);
}

const patchNotePattern = /^docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md$/;
const hasPatchNote = stagedFiles.some((file) => patchNotePattern.test(file));

const requiredFiles = [
  "CHANGELOG.md",
  "docs/implementation-plan.md",
  "package.json",
  "apps/web/src/lib/build-meta.ts",
  "apps/web/public/version.json",
];

const missingRequiredFiles = requiredFiles.filter((file) => !stagedFiles.includes(file));
const errors = [];

if (!hasPatchNote) {
  errors.push(
    "Protocol violation: stage one patch note entry file under docs/patch-notes/YYYY-MM-DD-vX.Y.Z-title.md."
  );
}

if (missingRequiredFiles.length) {
  errors.push(
    `Protocol violation: missing required staged files:\n- ${missingRequiredFiles.join("\n- ")}`
  );
}

if (errors.length) {
  console.error(errors.join("\n\n"));
  console.error("");
  console.error("Expected flow:");
  console.error("1) npm run protocol:prepare");
  console.error('2) npm run notes:new -- --title "..." --type fix --scope ...');
  console.error("3) Stage all required files and commit.");
  process.exit(1);
}

function getStagedFiles() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" }).trim();
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
