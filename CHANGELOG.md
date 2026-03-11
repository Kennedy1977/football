# Changelog

All notable product and technical changes should be documented here.

This project follows:
- Semantic Versioning (`major.minor.patch`)
- Keep a Changelog style categories (`Added`, `Changed`, `Fixed`, `Removed`, `Security`)

## [Unreleased]

Patch note entries:
<!-- PATCH_NOTES_FEED_START -->
- [2026-03-11 - v0.0.63 - Add manager avatar sprite selection and profile updates](docs/patch-notes/2026-03-11-v0.0.63-add-manager-avatar-sprite-selection-and-profile-updates.md)
- [2026-03-11 - v0.0.61 - Enhance manager profile dashboard and season insights](docs/patch-notes/2026-03-11-v0.0.61-enhance-manager-profile-dashboard-and-season-insights.md)
- [2026-03-11 - v0.0.60 - Add walk-on sequences and compact commit message enforcement](docs/patch-notes/2026-03-11-v0.0.60-add-walk-on-sequences-and-compact-commit-message-enforcement.md)
- [2026-03-11 - v0.0.59 - Fix footer version typing and confirm dependency currency](docs/patch-notes/2026-03-11-v0.0.59-fix-footer-version-typing-and-confirm-dependency-currency.md)
- [2026-03-11 - v0.0.58 - Enforce commit protocol and runtime version file loading](docs/patch-notes/2026-03-11-v0.0.58-enforce-commit-protocol-and-runtime-version-file-loading.md)
- [2026-03-11 - v0.0.57 - Introduce patch notes and git workflow format](docs/patch-notes/2026-03-11-v0.0.57-introduce-patch-notes-and-git-workflow-format.md)
<!-- PATCH_NOTES_FEED_END -->

### Added
- Manager avatar sprite-sheet support with reusable avatar and avatar-picker UI components.
- Post-onboarding avatar update endpoint: `PUT /api/onboarding/manager/avatar`.
- Patch notes workflow with templates under `docs/patch-notes/`.
- Commit/push format guide in `docs/git-commit-and-push-format.md`.
- Patch note generator script: `npm run notes:new`.
- Git protocol hook system (`.githooks` + validation scripts).
- Runtime version file generation: `apps/web/public/version.json`.

### Changed
- Manager onboarding/profile/dashboard contracts now include typed avatar data.
- Home/profile/topbar now render manager portraits from stored avatar selection.
- Added an explicit, reusable commit template file: `.gitmessage.txt`.
- Version pipeline now treats `package.json` as source of truth and refreshes both build meta and runtime version file.
- Living implementation spec now includes auto-maintained patch note feed.

### Fixed
- Avatar normalization now gracefully handles legacy manager avatar JSON shapes.
- Footer version can now update from runtime `version.json` on app load instead of relying only on static build constants.

## [0.0.57] - 2026-03-11

### Changed
- Historic entries prior to this point are not fully backfilled.
- As-built implementation details are documented in `docs/implementation-plan.md`.
