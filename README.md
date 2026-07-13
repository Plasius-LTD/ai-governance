# @plasius/ai-governance

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

### Rollout and rollback

Set `ai.governance.enabled` to `true` to enforce confidence policy. Setting it to `false`, or omitting it, is the rollout rollback path and resolves every request to feature-disabled `audit-only`; this permits processing without applying redaction. Use that rollback only when the deployment's surrounding controls make non-enforcement acceptable.

### Migration note

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
