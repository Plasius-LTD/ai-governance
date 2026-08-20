import { describe, expect, it } from "vitest";

import {
  AI_GOVERNANCE_ENV_PREFIX,
  AI_GOVERNANCE_FEATURE_FLAGS,
  AI_GOVERNANCE_FEATURE_FLAG_ID,
  AI_GOVERNANCE_PACKAGE,
  AI_GOVERNANCE_DATA_CLASSIFICATIONS,
  AI_GOVERNANCE_OUTCOMES,
  isAiGovernanceOutcomeAllowed,
  resolveAiGovernanceDecision,
  packageDescriptor,
} from "../src/index.js";

describe("@plasius/ai-governance", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_GOVERNANCE_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_GOVERNANCE_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(AI_GOVERNANCE_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });

  it("declares the governance feature flag", () => {
    expect(AI_GOVERNANCE_FEATURE_FLAGS).toEqual({
      decisions: AI_GOVERNANCE_FEATURE_FLAG_ID,
    });
  });

  it("supports all core governance outcomes", () => {
    expect(AI_GOVERNANCE_OUTCOMES).toEqual([
      "allow",
      "deny",
      "escalate",
      "redact",
      "audit-only",
    ]);
  });

  it("flags sensitive allow decisions below confidence threshold", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "allow",
        policyId: "policy-allow",
        policyVersion: "2026-05-A",
        correlationId: "corr-1",
        dataClassification: AI_GOVERNANCE_DATA_CLASSIFICATIONS[3]!,
        confidence: 0.1,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      outcome: "redact",
      requestedDecision: "allow",
      reasonCodes: ["low-confidence-sensitive-content"],
      source: "policy",
      enabledFeatureFlags: [AI_GOVERNANCE_FEATURE_FLAGS.decisions],
      dataClassification: "sensitive",
    });
  });

  it("escalates low-confidence denies", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "deny",
        policyId: "policy-deny",
        policyVersion: "2026-05-A",
        correlationId: "corr-2",
        confidence: 0.2,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      requestedDecision: "deny",
      outcome: "escalate",
      reasonCodes: ["low-confidence-denial-escalated"],
      enabledFeatureFlags: [AI_GOVERNANCE_FEATURE_FLAGS.decisions],
    });
  });

  it.each([
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["negative confidence", -0.01],
  ])(
    "normalizes %s to zero and fails direct redaction closed",
    (_label, confidence) => {
      expect(
        resolveAiGovernanceDecision({
          requestedDecision: "redact",
          policyId: "policy-invalid-confidence",
          policyVersion: "2026-05-A",
          correlationId: "corr-invalid-confidence",
          confidence,
          featureFlags: {
            [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
          },
        })
      ).toMatchObject({
        confidence: 0,
        outcome: "escalate",
        reasonCodes: ["low-confidence-redaction-escalated"],
        audit: {
          outcome: "escalate",
          confidence: 0,
        },
      });
    }
  );

  it("fails closed when direct redaction confidence is unreliable", () => {
    const result = resolveAiGovernanceDecision({
      requestedDecision: "redact",
      policyId: "policy-redact",
      policyVersion: "2026-05-A",
      correlationId: "corr-redact",
      confidence: 0.1,
      featureFlags: {
        [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
      },
    });

    expect(result).toMatchObject({
      requestedDecision: "redact",
      outcome: "escalate",
      reasonCodes: ["low-confidence-redaction-escalated"],
      source: "policy",
      audit: {
        outcome: "escalate",
      },
    });
    expect(isAiGovernanceOutcomeAllowed(result.outcome)).toBe(false);
  });

  it.each([
    [0.349999, "escalate", "low-confidence-redaction-escalated"],
    [0.35, "redact", "governance-policy-pass"],
    [1, "redact", "governance-policy-pass"],
  ] as const)(
    "applies the direct redaction threshold at confidence %s",
    (confidence, outcome, reasonCode) => {
      const result = resolveAiGovernanceDecision({
        requestedDecision: "redact",
        policyId: "policy-redact-boundary",
        policyVersion: "2026-05-A",
        correlationId: `corr-redact-${confidence}`,
        confidence,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      });

      expect(result).toMatchObject({
        confidence,
        outcome,
        reasonCodes: [reasonCode],
        audit: { outcome },
      });
      expect(isAiGovernanceOutcomeAllowed(result.outcome)).toBe(
        outcome === "redact"
      );
    }
  );

  it("appends the fail-closed reason without mutating caller reasons", () => {
    const callerReasons = Object.freeze(["caller-review-required", " "]);

    const result = resolveAiGovernanceDecision({
      requestedDecision: "redact",
      policyId: "policy-redact-reasons",
      policyVersion: "2026-05-A",
      correlationId: "corr-redact-reasons",
      confidence: 0.2,
      reasonCodes: callerReasons,
      featureFlags: {
        [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
      },
    });

    expect(result.reasonCodes).toEqual([
      "caller-review-required",
      "low-confidence-redaction-escalated",
    ]);
    expect(result.reasonCodes).not.toBe(callerReasons);
    expect(callerReasons).toEqual(["caller-review-required", " "]);
  });

  it("adds a pass reason when governance allows the requested outcome", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "allow",
        policyId: "policy-pass",
        policyVersion: "2026-05-A",
        correlationId: "corr-pass",
        confidence: 0.99,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      outcome: "allow",
      reasonCodes: ["governance-policy-pass"],
    });
  });

  it("defaults missing confidence and audit-only outcomes safely", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "audit-only",
        policyId: "policy-audit-only",
        policyVersion: "2026-05-A",
        correlationId: "corr-audit-only",
        reasonCodes: [" ", "pre-reviewed"],
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      confidence: 0,
      outcome: "audit-only",
      reasonCodes: ["pre-reviewed"],
    });

    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "audit-only",
        policyId: "policy-audit-default",
        policyVersion: "2026-05-A",
        correlationId: "corr-audit-default",
        confidence: 0.99,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      outcome: "audit-only",
      reasonCodes: ["governance-defaulted-to-audit"],
    });
  });

  it.each([
    ["absent", undefined],
    ["false", false],
  ] as const)(
    "keeps rollout-disabled low-confidence redaction audit-only when the flag is %s",
    (_label, enabled) => {
      const featureFlags =
        enabled === undefined
          ? undefined
          : { [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: enabled };
      const result = resolveAiGovernanceDecision({
        requestedDecision: "redact",
        policyId: "policy-rollout-disabled",
        policyVersion: "2026-05-A",
        correlationId: "corr-rollout-disabled",
        confidence: 0.1,
        featureFlags,
      });

      expect(result).toMatchObject({
        requestedDecision: "redact",
        outcome: "audit-only",
        reasonCodes: ["governance-feature-disabled"],
        source: "feature-disabled",
        enabledFeatureFlags: [],
        audit: { outcome: "audit-only" },
      });
      expect(isAiGovernanceOutcomeAllowed(result.outcome)).toBe(true);
    }
  );

  it.each([
    ["allow", true],
    ["deny", false],
    ["escalate", false],
    ["redact", true],
    ["audit-only", true],
  ] as const)(
    "reports whether the %s outcome allows processing",
    (outcome, allowed) => {
      expect(isAiGovernanceOutcomeAllowed(outcome)).toBe(allowed);
    }
  );
});
