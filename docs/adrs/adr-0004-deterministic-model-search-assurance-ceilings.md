# ADR-0004: Deterministic model-search assurance ceilings

- Date: 2026-08-20
- Status: Accepted

## Context

The unified model-resolution pipeline combines calibrated semantic scores with
evidence from text, rendered images, and deterministic identifier matches. A
score alone cannot establish that a candidate is safe to select: technical
hard constraints are independent gates, text-only evidence cannot justify a
non-exact high-assurance match, and every registered ranker has a calibrated
maximum assurance that downstream systems must not exceed.

`@plasius/asset-contracts` 0.3.1 defines the canonical assurance vocabulary,
thresholds, evidence modes, and model-match assessment shape. Governance still
needs a narrow policy decision that can be called before constructing that
larger contract and that fails closed when invoked from untyped JavaScript or
with data received across a runtime boundary.

The existing general AI governance decision resolver includes a deliberate
`audit-only` rollout state. Reusing it for model selection would be unsafe
because semantic assurance has no non-enforcing selectable equivalent.

## Decision

Add `resolveModelSearchAssurance` as an additive, pure policy function. It:

1. strictly validates an allow-listed input record and evidence/exactness
   combinations;
2. preserves every valid calibrated score without rounding or normalization;
3. derives raw assurance at `0.75` (`high`) and `0.50` (`low`), with an exact
   identifier match deriving `high` independently of score;
4. caps text-only evidence at `low`, then applies the ranker's declared ceiling;
5. forces the effective assurance to `none` when hard constraints fail; and
6. returns immutable data and stable, deterministically ordered reason codes.

Text-only evidence must be non-exact and may declare only a `low` or `none`
ceiling. Exact-identifier evidence must set `exactMatch: true`; vision and
multimodal evidence must be non-exact. Invalid values, non-finite or out-of-range
scores, accessors, proxies that throw, unexpected fields, and inconsistent
evidence/exactness combinations return a frozen `valid: false`, `none` decision.
The invalid result uses `score: null` so a fabricated normalized score cannot be
mistaken for calibrated evidence.

The policy imports its literal unions, calibrated thresholds, evidence modes,
and ceiling reason values directly from `@plasius/asset-contracts` 0.3.1 or
newer. This keeps the governance boundary linked to the canonical contract
without requiring it to construct or validate a full asset assessment.

The helper accepts no governance feature-flag snapshot and has no `audit-only`
band. Its parent flow is remotely controlled by
`asset.pipeline.unified-ai-assets.enabled`; rollback stops the flow at the host
boundary rather than weakening any assessment.

## Consequences

- Raw score evidence remains auditable alongside both raw and effective bands.
- Text-only, declared-ceiling, hard-gate, and invalid-input constraints have
  stable reason codes for downstream audit records.
- Exact identifier matches can be high assurance without allowing semantic,
  technical, or ranker ceilings to be bypassed.
- Existing AI governance exports and behavior remain source-compatible because
  the model-search surface is additive and separate.
- Consumers must branch on `valid` before mapping the result into a canonical
  `ModelMatchAssessment`.
- The rollout flag is evaluated by the host; the pure policy stays deterministic
  and cannot silently downgrade to a non-enforcing selection path.
