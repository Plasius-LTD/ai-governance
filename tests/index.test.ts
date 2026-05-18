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

  it("defaults non-finite confidence to zero before policy evaluation", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "allow",
        policyId: "policy-nan",
        policyVersion: "2026-05-A",
        correlationId: "corr-nan",
        dataClassification: "sensitive",
        confidence: Number.NaN,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      confidence: 0,
      outcome: "redact",
      reasonCodes: ["low-confidence-sensitive-content"],
    });
  });

  it("disables low-confidence redaction requests for audit only", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "redact",
        policyId: "policy-redact",
        policyVersion: "2026-05-A",
        correlationId: "corr-redact",
        confidence: 0.1,
        featureFlags: {
          [AI_GOVERNANCE_FEATURE_FLAGS.decisions]: true,
        },
      })
    ).toMatchObject({
      requestedDecision: "redact",
      outcome: "audit-only",
      reasonCodes: ["redaction-disabled-for-unreliable-input"],
    });
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

  it("falls back to audit-only when governance flag is disabled", () => {
    expect(
      resolveAiGovernanceDecision({
        requestedDecision: "allow",
        policyId: "policy-audit",
        policyVersion: "2026-05-A",
        correlationId: "corr-3",
        confidence: 0.99,
      })
    ).toMatchObject({
      requestedDecision: "allow",
      outcome: "audit-only",
      reasonCodes: ["governance-feature-disabled"],
      source: "feature-disabled",
      enabledFeatureFlags: [],
    });
  });

  it("identifies audit-only as a non-enforcing outcome", () => {
    expect(isAiGovernanceOutcomeAllowed("audit-only")).toBe(true);
    expect(isAiGovernanceOutcomeAllowed("deny")).toBe(false);
  });
});
