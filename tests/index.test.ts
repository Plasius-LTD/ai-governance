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
