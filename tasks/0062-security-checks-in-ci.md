# 0062: Free security checks in CI

Status: Open
Specs: [0007](../specs/0007-ci.md) (two ACs are added when this is built)

## Goal

The project handles Google sign-in, row level security and a Telegram token, and its only automation for
dependencies is Dependabot's weekly version bumps. Add what is free on a private repository: `npm audit` for known
vulnerabilities in production dependencies and gitleaks for committed secrets.

## What the owner has to do

One switch, not code: Settings, Code security, **Dependabot alerts** (and optionally security updates). It is off now
(`gh api repos/a1mirr/kektura/vulnerability-alerts` answers 404). With it on, Dependabot opens security pull
requests on its own, outside the weekly schedule. CodeQL and GitHub's secret scanning are not free for a private
repository and are out of scope.

## Requirements

- A job `Security checks` (on pull requests, on pushes to `main` and weekly on a schedule, because an advisory
  appears without any change of ours) runs `npm audit --omit=dev --audit-level=high` and fails on a known high or
  critical vulnerability in a production dependency. An advisory that has no fix yet may be allow-listed in a file
  under `.github/` with a reason and an expiry date; an expired entry fails the job again.
- The same job scans the working tree and the whole git history for committed secrets with gitleaks (the release
  binary, a pinned version checked against its published checksum; it needs no licence and no account for a
  personal repository). The local Supabase demo keys used by the test server are allow-listed by value, nothing
  else is. A finding fails the job; the output is redacted (`--redact`), so the secret is never printed.

## Done when

- [ ] A job `Security checks` in `ci.yml` with `npm audit --omit=dev --audit-level=high` and the allow-list with expiry
- [ ] gitleaks (pinned release, checksum verified, `--redact`) over the tree and the whole history, with the local Supabase demo keys allow-listed by value
- [ ] Tests for the job's triggers, commands, the pin and the redaction; the allow-list's expiry has a test
- [ ] The first run's findings are fixed or allow-listed with a reason
- [ ] The requirements are written into spec 0007 as ACs, with their coverage rows (spec 0034 AC-6)

## Spec changes

Filled in when built.
