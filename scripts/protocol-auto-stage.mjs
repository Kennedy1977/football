import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (process.env.SKIP_PROTOCOL_CHECK === "1") {
  process.exit(0);
}

const rootDir = process.cwd();
const requiredFiles = [
  "CHANGELOG.md",
  "docs/implementation-plan.md",
  "package.json",
  "apps/web/src/lib/build-meta.ts",
  "apps/web/public/version.json",
];
const patchNotePattern = /^docs\/patch-notes\/\d{4}-\d{2}-\d{2}-v\d+\.\d+\.\d+-[a-z0-9-]+\.md$/;

const initialStaged = getStagedFiles();
if (!initialStaged.length) {
  process.exit(0);
}

runCommand("npm", ["run", "protocol:prepare"]);

let stagedFiles = getStagedFiles();
let stagedPatchNotes = stagedFiles.filter((file) => patchNotePattern.test(file));
let selectedPatchNote = stagedPatchNotes.length ? stagedPatchNotes[stagedPatchNotes.length - 1] : null;

if (!stagedPatchNotes.length) {
  const existingPatchNote = findLatestPatchNoteForCurrentVersion();
  if (existingPatchNote) {
    selectedPatchNote = existingPatchNote;
    runCommand("git", ["add", existingPatchNote]);
  } else {
    const title = process.env.PROTOCOL_NOTES_TITLE || deriveDefaultTitle(initialStaged);
    const type = process.env.PROTOCOL_NOTES_TYPE || "chore";
    const scope = process.env.PROTOCOL_NOTES_SCOPE || deriveDefaultScope(initialStaged);
    runCommand("npm", ["run", "notes:new", "--", "--title", title, "--type", type, "--scope", scope]);
    selectedPatchNote = findLatestPatchNoteForCurrentVersion();
    if (selectedPatchNote) {
      runCommand("git", ["add", selectedPatchNote]);
    }
  }

  stagedFiles = getStagedFiles();
  stagedPatchNotes = stagedFiles.filter((file) => patchNotePattern.test(file));
  if (!selectedPatchNote && stagedPatchNotes.length) {
    selectedPatchNote = stagedPatchNotes[stagedPatchNotes.length - 1];
  }
}

const filesToStage = new Set(requiredFiles);

if (fs.existsSync(path.resolve(rootDir, "package-lock.json"))) {
  filesToStage.add("package-lock.json");
}

if (selectedPatchNote) {
  filesToStage.add(selectedPatchNote);
}

for (const file of filesToStage) {
  if (fs.existsSync(path.resolve(rootDir, file))) {
    runCommand("git", ["add", file]);
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status !== "number" || result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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

function deriveDefaultTitle(stagedFiles) {
  const primaryFile = stagedFiles.find((file) => !isProtocolFile(file));
  if (!primaryFile) {
    return "protocol auto update";
  }

  const fileName = path.basename(primaryFile).replace(/\.[a-z0-9]+$/i, "");
  const cleaned = fileName.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!cleaned) {
    return "protocol auto update";
  }

  return `update ${cleaned.toLowerCase()}`.slice(0, 80);
}

function deriveDefaultScope(stagedFiles) {
  const primaryFile = stagedFiles.find((file) => !isProtocolFile(file));
  if (!primaryFile) {
    return "general";
  }

  if (primaryFile.startsWith("apps/web/")) {
    return "web";
  }

  if (primaryFile.startsWith("apps/server/")) {
    return "server";
  }

  if (primaryFile.startsWith("database/")) {
    return "database";
  }

  if (primaryFile.startsWith("docs/")) {
    return "docs";
  }

  return "general";
}

function isProtocolFile(file) {
  return requiredFiles.includes(file) || patchNotePattern.test(file) || file === "package-lock.json";
}

function findLatestPatchNoteForCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, "package.json"), "utf8"));
  const version = String(pkg.version || "0.0.0").replace(/^v/i, "");
  const notesDir = path.resolve(rootDir, "docs/patch-notes");
  if (!fs.existsSync(notesDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(notesDir)
    .filter((entry) => entry.includes(`-v${version}-`) && patchNotePattern.test(`docs/patch-notes/${entry}`))
    .map((entry) => ({
      file: `docs/patch-notes/${entry}`,
      mtime: fs.statSync(path.resolve(notesDir, entry)).mtimeMs,
    }))
    .sort((a, b) => a.mtime - b.mtime);

  return candidates.length ? candidates[candidates.length - 1].file : null;
}
