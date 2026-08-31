# @plasius/ai-governance

[![npm version](https://img.shields.io/npm/v/@plasius/ai-governance.svg)](https://www.npmjs.com/package/@plasius/ai-governance)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/ai-governance/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/ai-governance/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/ai-governance)](https://codecov.io/gh/Plasius-LTD/ai-governance)
[![License](https://img.shields.io/github/license/Plasius-LTD/ai-governance)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

AI guardrail, policy decision, confidence, and audit contracts for Plasius agentic AI.

## Scope

This package defines policy decision contracts for allow, deny, escalate, redact, and audit-only outcomes.

- decisions are resolved against confidence and data classification inputs
- feature-flag snapshots can force audit-only rollout behavior
- each outcome includes structured audit metadata for downstream compliance and replay

## Outcome semantics

| Outcome | Processing may continue | Enforced control |
| --- | --- | --- |
| `allow` | Yes | No additional control |
| `deny` | No | Request is blocked |
| `escalate` | No | Human or higher-assurance review is required |
| `redact` | Yes | Redaction must be applied by the caller |
| `audit-only` | Yes | None; evidence is recorded without enforcing a control |

When governance is enabled, a direct `redact` decision with normalized confidence below `0.35` resolves to `escalate` with reason code `low-confidence-redaction-escalated`. This is fail-closed: unreliable evidence cannot silently turn a privacy control into a non-enforcing pass. The audit outcome mirrors the resolved `escalate` outcome.

`audit-only` remains an allowed, deliberately non-enforcing public outcome for compatibility. It can be requested explicitly, and it is also returned with source `feature-disabled` while the governance feature flag is absent or false. Callers that require an enforced privacy control must inspect the concrete outcome and must not treat `isAiGovernanceOutcomeAllowed(...)` as proof that redaction occurred.

## Model-search assurance

`resolveModelSearchAssurance` is a separate, deterministic policy boundary for
3D model matching. It preserves a valid calibrated score while deriving its raw
band (`high >= 0.75`, `low >= 0.50`, otherwise `none`) and then applies, in
order, the evidence ceiling, the ranker's declared ceiling, and the independent
hard-constraint gate.

```ts
import { resolveModelSearchAssurance } from "@plasius/ai-governance";

const decision = resolveModelSearchAssurance({
  score: 0.93,
  hardConstraintPass: true,
  evidenceMode: "text-only",
  exactMatch: false,
  assuranceCeiling: "low",
});

// decision.score === 0.93
// decision.rawAssurance === "high"
// decision.assurance === "low"
// decision.reasonCodes === ["text-only-assurance-ceiling"]
```

| Condition | Effective assurance | Stable reason |
| --- | --- | --- |
| A hard constraint fails | `none` | `hard-constraint-failed` |
| Text-only raw evidence would be `high` | At most `low` | `text-only-assurance-ceiling` |
| The declared ranker ceiling lowers the evidence-constrained band | Declared ceiling | `ranker-assurance-ceiling` |
| JavaScript/runtime input is malformed or internally inconsistent | `none` | `model-search-assurance-invalid-input` |

`exact-identifier` evidence must set `exactMatch: true` and may derive `high`
independently of score, but it can never bypass failed hard constraints or a
lower declared ceiling. Text-only rankers must be non-exact and may declare
only `low` or `none`; vision and multimodal evidence must be non-exact. Invalid
input returns a frozen, discriminated `valid: false` decision with `score: null`
instead of throwing or guessing.

The assurance thresholds, bands, evidence modes, ceiling reason codes, and
their TypeScript types are imported from `@plasius/asset-contracts` 0.3.1 or
newer. The governance helper does not construct a full `ModelMatchAssessment`;
callers retain the calibrated score and policy reasons when they construct
that contract at the asset boundary.

This helper has no `audit-only` outcome and accepts no feature-flag snapshot.
Hosts gate the surrounding unified asset flow with
`asset.pipeline.unified-ai-assets.enabled`. Disabling that flag stops the flow;
it does not weaken an assessment or turn a failed gate into a selectable match.

## General-governance rollout and rollback

Set `ai.governance.enabled` to `true` to enforce confidence policy. Setting it to `false`, or omitting it, is the rollout rollback path and resolves every request to feature-disabled `audit-only`; this permits processing without applying redaction. Use that rollback only when the deployment's surrounding controls make non-enforcement acceptable.

## General-governance migration note

This security correction does not change public types or function signatures. Consumers that previously expected enabled low-confidence direct redaction to return `audit-only` must handle `escalate` as a non-allowing review state. Consumers using `isAiGovernanceOutcomeAllowed` retain existing behavior for all five outcomes.

## Install

```bash
npm install @plasius/ai-governance
```

## Usage

```ts
import { packageDescriptor } from "@plasius/ai-governance";

console.log(packageDescriptor.packageName);
```

```ts
import {
  AI_GOVERNANCE_FEATURE_FLAGS,
  resolveAiGovernanceDecision,
} from "@plasius/ai-governance";

const result = resolveAiGovernanceDecision({
  requestedDecision: "allow",
  policyId: "policy-default",
  policyVersion: "2026-05",
  correlationId: "corr-001",
  confidence: 0.92,
  dataClassification: "public",
  featureFlags: {
    [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
  },
});

console.log(result.outcome);
```

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run pack:check
```

## Release Workflow

Protected `main` releases use a two-step flow:

1. Run `.github/workflows/cd.yml` with `bump=patch|minor|major` to open or refresh a `release/vX.Y.Z` prep PR.
2. Merge that PR to `main`.
3. Rerun `.github/workflows/cd.yml` on `main` with `bump=none` to tag, draft the GitHub release, and publish to npm.

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

Production package publication runs only from `.github/workflows/cd.yml` on
protected `main`. The job verifies that the prepared commit is still the
current main commit and has an exact successful `ci.yml` push result before it
mutates release state. Public package CI delegates to the repository-owned
`.github/workflows/ci-hosted.yml` at the same reviewed revision, runs on explicit
GitHub-hosted capacity with package-manager caching disabled, and rejects fork
pull requests at both workflow boundaries. npm publication remains isolated on
GitHub-hosted Node.js 24 with pinned npm 11.6.2, uses the protected `production` environment and
short-lived npm OIDC with provenance, and has no long-lived npm write-token
fallback. Rollback disables CD; it never rewrites published package history.
<!-- END PLASIUS RELEASE INTEGRITY -->
