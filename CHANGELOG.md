# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - Restored exact-main npm publication on a GitHub-hosted runner through
    short-lived OIDC, with an enforced Node/npm runtime and no long-lived
    write-token fallback.
  - Moved public package CI to GitHub-hosted capacity so internal and external
    branches cannot queue on or execute against company-managed runners.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.6] - 2026-06-27

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed development dependency baselines to the latest stable published versions and regenerated the npm lockfile from a clean install.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.5] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.4] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.3] - 2026-05-20

- **Added**
  - Added policy outcome constants and decision-resolution contracts for governance allow/deny/escalate/redact/audit-only flows.

- **Changed**
- Expanded governance feature flag contracts with audit metadata, confidence thresholds, and escalation fallback behavior.

- **Fixed**
  - Release automation now prepares version/changelog updates on a release PR before publishing from protected `main`.
  - Removed an unused outcome index so the lint gate stays clean.

- **Security**
  - (placeholder)

## [0.1.2] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.1] - 2026-05-13

- Added initial public package scaffold with governance, legal, docs, build, test, and pack-check baselines.


[0.1.1]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.3
[0.1.4]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.4
[0.1.5]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.5
[0.1.6]: https://github.com/Plasius-LTD/ai-governance/releases/tag/v0.1.6
