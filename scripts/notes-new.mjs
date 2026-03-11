import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.resolve(rootDir, "package.json");
const notesDir = path.resolve(rootDir, "docs/patch-notes");
const changelogPath = path.resolve(rootDir, "CHANGELOG.md");
const implementationPlanPath = path.resolve(rootDir, "docs/implementation-plan.md");
const FEED_START = "<!-- PATCH_NOTES_FEED_START -->";
const FEED_END = "<!-- PATCH_NOTES_FEED_END -->";

const args = parseArgs(process.argv.slice(2));
const title = String(args.title || "").trim();

if (!title) {
  printUsageAndExit("Missing required --title argument.");
}

const type = String(args.type || "chore").trim();
const scope = String(args.scope || "general").trim();
const date = toIsoDate(new Date());
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = String(args.version || pkg.version || "0.0.0").replace(/^v/i, "");

const slug = toSlug(title);
const filename = `${date}-v${version}-${slug}.md`;
const filePath = path.resolve(notesDir, filename);

if (fs.existsSync(filePath)) {
  printUsageAndExit(`Patch note already exists: docs/patch-notes/${filename}`);
}

const content = `# v${version} - ${title}

Date: ${date}
Type: ${type}
Scope: ${scope}

## Summary

- 

## Added

- None.

## Changed

- None.

## Fixed

- None.

## Removed

- None.

## Validation

- [ ] npm run typecheck
- [ ] Manual QA completed on affected screens/routes.

## Risks / Follow-up

- 
`;

fs.mkdirSync(notesDir, { recursive: true });
fs.writeFileSync(filePath, content, "utf8");

const feedEntry = `- [${date} - v${version} - ${title}](docs/patch-notes/${filename})`;
updatePatchNotesFeed(changelogPath, feedEntry);
updatePatchNotesFeed(implementationPlanPath, feedEntry);

console.log(`Created patch note: docs/patch-notes/${filename}`);
console.log("Next steps:");
console.log("1) Fill in the generated patch note sections.");
console.log("2) Review auto-updated patch note feeds in CHANGELOG and implementation plan.");
console.log("3) Commit with Patch-Notes reference in commit body.");

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function toIsoDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toSlug(input) {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "update";
}

function printUsageAndExit(message) {
  console.error(message);
  console.error("");
  console.error("Usage:");
  console.error('  npm run notes:new -- --title "Short update title" [--type fix] [--scope match-live] [--version 0.0.58]');
  process.exit(1);
}

function updatePatchNotesFeed(targetPath, feedEntry) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const source = fs.readFileSync(targetPath, "utf8");
  const startIdx = source.indexOf(FEED_START);
  const endIdx = source.indexOf(FEED_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return;
  }

  const before = source.slice(0, startIdx + FEED_START.length);
  const between = source.slice(startIdx + FEED_START.length, endIdx);
  const after = source.slice(endIdx);

  const existingEntries = between
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["));

  if (!existingEntries.includes(feedEntry)) {
    existingEntries.unshift(feedEntry);
  }

  const updatedBetween = `\n${existingEntries.join("\n")}\n`;
  const updated = `${before}${updatedBetween}${after}`;
  fs.writeFileSync(targetPath, updated, "utf8");
}
