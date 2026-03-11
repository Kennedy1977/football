# Commit + Push Format

Use this format for every change set.
This protocol is enforced by git hooks in `.githooks`.

## 0. One-time setup

```bash
npm run protocol:install
```

This configures:
- `core.hooksPath=.githooks`
- `commit.template=.gitmessage.txt`

## 1. Commit message format

Header:

```text
<type>(<scope>): <short imperative summary>
```

Types:
- `feat`: new behavior/user-facing feature
- `fix`: bug fix/regression fix
- `refactor`: structural change with no intended behavior change
- `perf`: performance improvement
- `docs`: documentation only
- `build`: build/release/versioning/tooling behavior
- `chore`: maintenance/admin work
- `test`: tests only

Examples:
- `fix(match-live): center pitch canvas and tighten HUD spacing`
- `feat(result): add scorer names and full-time stats tab`
- `build(version): bump patch and regenerate build metadata`

## 2. Commit body format

Use a compact body. Only `Patch-Notes` is mandatory.

```text
- <optional short detail>
- <optional short detail>
Patch-Notes: docs/patch-notes/<filename>.md
```

## 3. Branch naming format

```text
<type>/<short-kebab-scope>
```

Examples:
- `fix/match-live-hud`
- `feat/promotion-result-view`
- `build/release-patch-notes`

## 4. Push format

Use explicit upstream on first push:

```bash
git push -u origin <branch-name>
```

Subsequent pushes:

```bash
git push
```

## 5. Recommended release commit sequence

1. Bump version and regenerate build metadata:
   - `npm run protocol:prepare`
2. Generate patch note file.
3. Stage code + notes + changelog + living spec updates together.
4. Commit using the format above.
5. Push branch.
6. Open PR and include patch note link in PR description.

Required staged files per commit:
- `package.json`
- `apps/web/src/lib/build-meta.ts`
- `apps/web/public/version.json`
- `CHANGELOG.md`
- `docs/implementation-plan.md`
- one patch note entry under `docs/patch-notes/YYYY-MM-DD-vX.Y.Z-title.md`

Protocol checks:
- Pre-commit: `scripts/protocol-check-staged.mjs`
- Commit-msg: `scripts/protocol-check-commit-msg.mjs`

Example:

```bash
npm run protocol:prepare
npm run notes:new -- --title "Center live pitch and compact TV HUD" --type fix --scope match-live
git add -A
git commit
git push -u origin fix/match-live-hud
```

Manual commit message example:

```text
fix(match-live): center pitch and compact TV HUD

- Centered sim layout and reduced HUD footprint.
- Updated match commentary overlay behavior.
Patch-Notes: docs/patch-notes/2026-03-11-v0.0.57-center-live-pitch-and-compact-tv-hud.md
```
