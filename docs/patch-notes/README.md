# Patch Notes Workflow

Create one patch note file per shipped update.

## 1. Generate a new patch note file

```bash
npm run notes:new -- --title "Short update title" --type fix --scope match-live
```

Arguments:
- `--title` (required): short human-readable title.
- `--type` (optional): `feat`, `fix`, `docs`, `refactor`, `perf`, `build`, `chore`.
- `--scope` (optional): module/screen/area (for example `match-live`, `shop`, `api-match`).
- `--version` (optional): overrides `package.json` version.

Generated files are created in:
- `docs/patch-notes/YYYY-MM-DD-vX.Y.Z-your-title.md`

`notes:new` also updates the patch-note feed blocks in:
- `CHANGELOG.md`
- `docs/implementation-plan.md`

## 2. Fill all sections before commit

Use the template sections:
- Summary
- Added / Changed / Fixed / Removed
- Validation
- Risks / Follow-up

## 3. Link patch notes in commit body

Include:
- `Patch-Notes: docs/patch-notes/<filename>.md`

For commit format and push steps, follow:
- `docs/git-commit-and-push-format.md`

## 4. Required protocol sequence

```bash
npm run protocol:prepare
npm run notes:new -- --title "..." --type fix --scope ...
git add -A
git commit
git push
```
