import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const messageFile = process.argv[2];
if (!messageFile) {
  console.error("Missing commit message file path.");
  process.exit(1);
}

const commitMessage = fs.readFileSync(messageFile, "utf8").trim();
if (!commitMessage) {
  console.error("Empty commit message is not allowed.");
  process.exit(1);
}

const [headerLine] = commitMessage.split(/\r?\n/);
if (/^(Merge|Revert|fixup!|squash!)/.test(headerLine)) {
  process.exit(0);
}

const headerPattern = /^(feat|fix|refactor|perf|docs|build|chore|test)\([a-z0-9][a-z0-9-]*\): .+/;
if (!headerPattern.test(headerLine)) {
  console.error("Commit header must match: <type>(<scope>): <summary>");
  console.error('Example: fix(match-live): center pitch and compact HUD');
  process.exit(1);
}

const requiredSections = ["Why:", "What:", "Validation:", "Patch-Notes:"];
for (const section of requiredSections) {
  const sectionPattern = new RegExp(`^${escapeRegex(section)}\\s*$`, "m");
  if (!sectionPattern.test(commitMessage)) {
    console.error(`Missing required commit section: ${section}`);
    process.exit(1);
  }
}

const patchNotesPathMatch = commitMessage.match(
  /Patch-Notes:\s*(?:\r?\n)+-\s+(docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md)\s*$/m
);

if (!patchNotesPathMatch) {
  console.error("Patch-Notes section must include exactly one patch note file path bullet.");
  process.exit(1);
}

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const patchNotePath = path.resolve(repoRoot, patchNotesPathMatch[1]);

if (!fs.existsSync(patchNotePath)) {
  console.error(`Patch note file does not exist: ${patchNotesPathMatch[1]}`);
  process.exit(1);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
