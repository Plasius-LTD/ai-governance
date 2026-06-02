# @plasius/ai-governance

AI guardrail, policy decision, confidence, and audit contracts for Plasius agentic AI.

## Scope

This package defines policy decision contracts for allow, deny, escalate, redact, and audit-only outcomes.

- decisions are resolved against confidence and data classification inputs
- feature-flag snapshots can force audit-only rollout behavior
- each outcome includes structured audit metadata for downstream compliance and replay

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

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0
