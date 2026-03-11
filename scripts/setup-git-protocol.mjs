import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const hooksDir = path.resolve(rootDir, ".githooks");
const commitMsgHook = path.resolve(hooksDir, "commit-msg");
const preCommitHook = path.resolve(hooksDir, "pre-commit");

if (!fs.existsSync(commitMsgHook) || !fs.existsSync(preCommitHook)) {
  console.error("Missing .githooks scripts. Ensure .githooks/commit-msg and .githooks/pre-commit exist.");
  process.exit(1);
}

fs.chmodSync(commitMsgHook, 0o755);
fs.chmodSync(preCommitHook, 0o755);

execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
execSync("git config commit.template .gitmessage.txt", { stdio: "inherit" });

console.log("");
console.log("Git protocol hooks installed.");
console.log("Active hooks path: .githooks");
console.log("Active commit template: .gitmessage.txt");
