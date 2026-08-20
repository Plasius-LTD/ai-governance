# ADR-0002: Fail-closed redaction and audit-only semantics

- Date: 2026-07-13
- Status: Accepted

## Context

The governance resolver previously converted an enabled, low-confidence direct `redact` request into `audit-only`. The public allowance helper intentionally treats `audit-only` as permitting processing, so a requested privacy control could be lost precisely when its confidence evidence was unreliable.

The package also uses feature-disabled `audit-only` as its established rollout and rollback behavior. Changing that public behavior, or globally making `audit-only` non-allowing, would break existing consumers and conflate rollout state with an enforced policy decision.

## Decision

When `ai.governance.enabled` is true, a direct `redact` request whose normalized confidence is below `0.35` resolves to `escalate`. The resolver appends the stable reason code `low-confidence-redaction-escalated`, records `escalate` in audit metadata, and therefore produces a result that `isAiGovernanceOutcomeAllowed` rejects.

The threshold is inclusive on the valid side: confidence `0.35` retains `redact`. Non-finite and negative confidence normalize to zero and therefore escalate. Existing caller reason codes remain ordered ahead of the policy reason and caller input is not mutated.

Feature-disabled decisions continue to resolve to `audit-only` with source `feature-disabled`, and an explicitly requested `audit-only` decision remains allowed and non-enforcing. The public outcome union, resolver signature, result shape, and allowance-helper behavior are unchanged.

## Consequences

- Unreliable direct redaction evidence fails closed to a review state instead of becoming a non-enforcing pass.
- Consumers must handle `escalate` for enabled low-confidence direct redaction after upgrading.
- `isAiGovernanceOutcomeAllowed` answers whether processing may continue; it does not prove that a privacy control was applied.
- Disabling the feature remains a compatible rollback mechanism, but surrounding systems must accept that no governance control is enforced in that state.
- Boundary, invalid-confidence, reason-ordering, audit, feature-disabled, and exhaustive allowance tests protect these semantics.
