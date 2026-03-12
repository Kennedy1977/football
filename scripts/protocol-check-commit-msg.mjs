import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const patchNotePattern = /^docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md$/;

const messageFile = process.argv[2];
if (!messageFile) {
  console.error("Missing commit message file path.");
  process.exit(1);
}

const rawCommitMessage = fs.readFileSync(messageFile, "utf8");
const stagedPatchNotes = getStagedPatchNotes();
const commitMessage = autoFillPatchNotes(rawCommitMessage, stagedPatchNotes).trim();

if (rawCommitMessage !== `${commitMessage}\n`) {
  fs.writeFileSync(messageFile, `${commitMessage}\n`, "utf8");
}

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

const patchNotesPathMatch = commitMessage.match(
  /Patch-Notes:\s*(?:\r?\n-\s*)?(docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md)/m
);

if (!patchNotesPathMatch) {
  console.error("Commit message must include: Patch-Notes: docs/patch-notes/YYYY-MM-DD-vX.Y.Z-title.md");
  process.exit(1);
}

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const patchNotePath = path.resolve(repoRoot, patchNotesPathMatch[1]);

if (!fs.existsSync(patchNotePath)) {
  console.error(`Patch note file does not exist: ${patchNotesPathMatch[1]}`);
  process.exit(1);
}

function getStagedPatchNotes() {
  const output = execSync("git diff --cached --name-only --diff-filter=ACMR", { encoding: "utf8" }).trim();
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => patchNotePattern.test(line));
}

function autoFillPatchNotes(sourceMessage, stagedPatchNotes) {
  if (!stagedPatchNotes.length) {
    return sourceMessage;
  }

  const patchNoteRef = stagedPatchNotes[stagedPatchNotes.length - 1];

  if (/Patch-Notes:\s*docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md/m.test(sourceMessage)) {
    return sourceMessage;
  }

  if (/Patch-Notes:\s*docs\/patch-notes\/<filename>\.md/m.test(sourceMessage)) {
    return sourceMessage.replace(/Patch-Notes:\s*docs\/patch-notes\/<filename>\.md/m, `Patch-Notes: ${patchNoteRef}`);
  }

  if (/Patch-Notes:\s*$/m.test(sourceMessage)) {
    return sourceMessage.replace(/Patch-Notes:\s*$/m, `Patch-Notes: ${patchNoteRef}`);
  }

  const trimmed = sourceMessage.trimEnd();
  if (!trimmed) {
    return `Patch-Notes: ${patchNoteRef}\n`;
  }

  return `${trimmed}\n\nPatch-Notes: ${patchNoteRef}\n`;
}
