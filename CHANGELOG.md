# Changelog

All notable product and technical changes should be documented here.

This project follows:
- Semantic Versioning (`major.minor.patch`)
- Keep a Changelog style categories (`Added`, `Changed`, `Fixed`, `Removed`, `Security`)

## [Unreleased]

Patch note entries:
<!-- PATCH_NOTES_FEED_START -->
- [2026-03-11 - v0.0.68 - Fix oversized top-nav profile avatar](docs/patch-notes/2026-03-11-v0.0.68-fix-oversized-top-nav-profile-avatar.md)
- [2026-03-11 - v0.0.67 - Add rarity borders to pitch and bench player avatars](docs/patch-notes/2026-03-11-v0.0.67-add-rarity-borders-to-pitch-and-bench-player-avatars.md)
- [2026-03-11 - v0.0.66 - Fix squad pitch player hover position jump](docs/patch-notes/2026-03-11-v0.0.66-fix-squad-pitch-player-hover-position-jump.md)
- [2026-03-11 - v0.0.65 - Auto-pick and auto-save lineup when formation changes](docs/patch-notes/2026-03-11-v0.0.65-auto-pick-and-auto-save-lineup-when-formation-changes.md)
- [2026-03-11 - v0.0.64 - Apply each team's own formation in match sim](docs/patch-notes/2026-03-11-v0.0.64-apply-each-team-s-own-formation-in-match-sim.md)
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
- Match start/live contracts now carry both clubs' formation codes into match runtime config.
- Squad formation changes now auto-pick the best eligible XI for the selected shape.
- Squad lineup and formation edits now auto-save when valid, without manual save action.
- Squad formation pitch and bench avatars now show rarity-coded quality borders.
- Added an explicit, reusable commit template file: `.gitmessage.txt`.
- Version pipeline now treats `package.json` as source of truth and refreshes both build meta and runtime version file.
- Living implementation spec now includes auto-maintained patch note feed.

### Fixed
- Top-nav manager profile avatar is now constrained to icon size and no longer expands the header.
- Squad formation-pitch player markers no longer shift out of position on hover.
- Live match simulation now applies independent home/away formation layouts instead of defaulting to a single shape.
- Avatar normalization now gracefully handles legacy manager avatar JSON shapes.
- Footer version can now update from runtime `version.json` on app load instead of relying only on static build constants.

## [0.0.57] - 2026-03-11

### Changed
- Historic entries prior to this point are not fully backfilled.
- As-built implementation details are documented in `docs/implementation-plan.md`.
