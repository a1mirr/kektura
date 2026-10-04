# 0045: Free security checks in CI

Status: Open
Specs: [0007](../specs/0007-ci.md) AC-8, AC-9 (added)

## Goal

The project handles Google sign-in, row level security and a Telegram token, and its only automation for
dependencies is Dependabot's weekly version bumps. Add what is free on a private repository: `npm audit` for known
vulnerabilities in production dependencies and gitleaks for committed secrets.

## What the owner has to do

One switch, not code: Settings, Code security, **Dependabot alerts** (and optionally security updates). It is off now
(`gh api repos/a1mirr/kektura/vulnerability-alerts` answers 404). With it on, Dependabot opens security pull
requests on its own, outside the weekly schedule. CodeQL and GitHub's secret scanning are not free for a private
repository and are out of scope.

## Done when

- [ ] A job `Security checks` in `ci.yml` (pull requests, `main`, weekly) with `npm audit --omit=dev --audit-level=high` and the allow-list with expiry
- [ ] gitleaks (pinned release, checksum verified, `--redact`) over the tree and the whole history, with the local Supabase demo keys allow-listed by value
- [ ] Tests for the job's triggers, commands, the pin and the redaction; the allow-list's expiry has a test
- [ ] The first run's findings are fixed or allow-listed with a reason
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Filled in when built.
