# Extension Changelogs

This directory contains changelog entries documenting significant changes to the TubeFocus Chrome extension.

## Format

Each changelog entry follows this format:

```markdown
# [Version/Date] - Feature/Change Name

**Type:** Feature | Bug Fix | Refactor | UI/UX | Performance | Security  
**Date:** YYYY-MM-DD  
**Author:** Name  
**Branch:** branch-name  
**Manifest Version:** X.X.X  

## Summary

Brief description of the change.

## Changes Made

- Detailed change 1
- Detailed change 2
- Detailed change 3

## User Impact

- What users will notice
- New features or improvements
- Breaking changes (if any)

## Testing

- How this was tested
- Browser versions tested
- Test results

## Rollback Plan

- How to revert if needed

## Screenshots (if UI changes)

Include screenshots or GIFs of UI changes.

## Related Issues/PRs

- Links to related issues
- Links to related PRs
```

## Naming Convention

Changelog files should be named: `YYYY-MM-DD-brief-description.md`

Examples:
- `2026-01-22-cursor-rules-setup.md`
- `2026-01-22-improve-score-display.md`
- `2026-01-15-manifest-v3-migration.md`

## When to Create a Changelog

Create a changelog entry for:
- ✅ New features
- ✅ UI/UX changes
- ✅ Manifest updates
- ✅ Permission changes
- ✅ API integration changes
- ✅ Performance improvements
- ✅ Security fixes
- ✅ Chrome Web Store releases

Don't create for:
- ❌ Minor bug fixes
- ❌ Typo corrections
- ❌ Code formatting
- ❌ Minor CSS tweaks

## Automation

Cursor AI is configured to:
1. Detect significant changes
2. Prompt for changelog creation
3. Generate changelog draft
4. Save to this directory
5. Update manifest version if needed

## Integration with Git

Each significant change should:
1. Be developed in a feature branch
2. Have a changelog entry created
3. Update `manifest.json` version
4. Be committed with the feature
5. Include changelog in the PR

## Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/dark-mode

# 2. Make changes
# ... code changes ...

# 3. Update manifest.json version
# 1.0.0 -> 1.1.0

# 4. Create changelog
# Cursor AI will prompt or you can manually create

# 5. Commit everything
git add .
git commit -m "feat: add dark mode support

See changelogs/2026-01-22-dark-mode.md for details"

# 6. Push and create PR
git push -u origin feature/dark-mode
```

## Chrome Web Store Releases

When releasing to Chrome Web Store:
1. Consolidate recent changelogs
2. Create release notes
3. Update extension description if needed
4. Tag the release in git: `git tag v1.1.0`

## Archive Policy

Changelogs are never deleted but may be moved to `changelogs/archive/YYYY/` after one year.
