import { describe, expect, it } from "vitest";

import {
  AI_GOVERNANCE_ENV_PREFIX,
  AI_GOVERNANCE_FEATURE_FLAGS,
  AI_GOVERNANCE_FEATURE_FLAG_ID,
  AI_GOVERNANCE_PACKAGE,
  AI_GOVERNANCE_DATA_CLASSIFICATIONS,
  AI_GOVERNANCE_OUTCOMES,
  MODEL_SEARCH_ASSURANCE_BANDS,
  MODEL_SEARCH_ASSURANCE_FEATURE_FLAG_ID,
  MODEL_SEARCH_ASSURANCE_REASON_CODES,
  MODEL_SEARCH_ASSURANCE_THRESHOLDS,
  MODEL_SEARCH_EVIDENCE_MODES,
  isAiGovernanceOutcomeAllowed,
  resolveModelSearchAssurance,
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

describe("model-search assurance policy", () => {
  it("exports the calibrated policy vocabulary and inherited rollout flag", () => {
    expect(MODEL_SEARCH_ASSURANCE_THRESHOLDS).toEqual({
      high: 0.75,
      low: 0.5,
    });
    expect(MODEL_SEARCH_ASSURANCE_BANDS).toEqual(["high", "low", "none"]);
    expect(MODEL_SEARCH_EVIDENCE_MODES).toEqual([
      "text-only",
      "vision",
      "multimodal",
      "exact-identifier",
    ]);
    expect(MODEL_SEARCH_ASSURANCE_FEATURE_FLAG_ID).toBe(
      "asset.pipeline.unified-ai-assets.enabled"
    );
    expect(MODEL_SEARCH_ASSURANCE_BANDS).not.toContain("audit-only");
  });

  it("preserves the calibrated score while capping text-only evidence at low", () => {
    const result = resolveModelSearchAssurance({
      score: 0.93,
      hardConstraintPass: true,
      evidenceMode: "text-only",
      exactMatch: false,
      assuranceCeiling: "low",
    });

    expect(result).toEqual({
      valid: true,
      policyVersion: "2026-08-20.v1",
      score: 0.93,
      rawAssurance: "high",
      assurance: "low",
      hardConstraintPass: true,
      evidenceMode: "text-only",
      exactMatch: false,
      declaredAssuranceCeiling: "low",
      appliedAssuranceCeiling: "low",
      reasonCodes: [MODEL_SEARCH_ASSURANCE_REASON_CODES.textOnlyCeiling],
    });
  });

  it.each([
    ["vision", 0.75],
    ["multimodal", 1],
  ] as const)(
    "allows %s evidence to remain high when gates and the ceiling permit",
    (evidenceMode, score) => {
      expect(
        resolveModelSearchAssurance({
          score,
          hardConstraintPass: true,
          evidenceMode,
          exactMatch: false,
          assuranceCeiling: "high",
        })
      ).toMatchObject({
        valid: true,
        score,
        rawAssurance: "high",
        assurance: "high",
        reasonCodes: [],
      });
    }
  );

  it("always returns none after a failed hard-constraint gate", () => {
    expect(
      resolveModelSearchAssurance({
        score: 0.99,
        hardConstraintPass: false,
        evidenceMode: "multimodal",
        exactMatch: false,
        assuranceCeiling: "high",
      })
    ).toMatchObject({
      valid: true,
      score: 0.99,
      rawAssurance: "high",
      assurance: "none",
      hardConstraintPass: false,
      reasonCodes: [
        MODEL_SEARCH_ASSURANCE_REASON_CODES.hardConstraintFailed,
      ],
    });
  });

  it.each([
    ["vision", 0.99, "low", "low"],
    ["multimodal", 0.7, "none", "none"],
    ["exact-identifier", 0.1, "low", "low"],
  ] as const)(
    "keeps a lower %s ranker ceiling authoritative for %s evidence",
    (evidenceMode, score, assuranceCeiling, expected) => {
      const exactMatch = evidenceMode === "exact-identifier";
      expect(
        resolveModelSearchAssurance({
          score,
          hardConstraintPass: true,
          evidenceMode,
          exactMatch,
          assuranceCeiling,
        })
      ).toMatchObject({
        valid: true,
        score,
        assurance: expected,
        declaredAssuranceCeiling: assuranceCeiling,
        appliedAssuranceCeiling: assuranceCeiling,
        reasonCodes: [
          MODEL_SEARCH_ASSURANCE_REASON_CODES.rankerCeiling,
        ],
      });
    }
  );

  it("allows an exact identifier match to derive high independently of score", () => {
    expect(
      resolveModelSearchAssurance({
        score: 0,
        hardConstraintPass: true,
        evidenceMode: "exact-identifier",
        exactMatch: true,
        assuranceCeiling: "high",
      })
    ).toMatchObject({
      valid: true,
      score: 0,
      rawAssurance: "high",
      assurance: "high",
      reasonCodes: [],
    });
  });

  it.each([
    [0.499999, "none"],
    [0.5, "low"],
    [0.749999, "low"],
    [0.75, "high"],
  ] as const)("classifies score %s as raw %s", (score, rawAssurance) => {
    expect(
      resolveModelSearchAssurance({
        score,
        hardConstraintPass: true,
        evidenceMode: "multimodal",
        exactMatch: false,
        assuranceCeiling: "high",
      })
    ).toMatchObject({ valid: true, score, rawAssurance, assurance: rawAssurance });
  });

  it("records both evidence and declared ceilings in deterministic order", () => {
    expect(
      resolveModelSearchAssurance({
        score: 0.9,
        hardConstraintPass: true,
        evidenceMode: "text-only",
        exactMatch: false,
        assuranceCeiling: "none",
      })
    ).toMatchObject({
      assurance: "none",
      appliedAssuranceCeiling: "none",
      reasonCodes: [
        MODEL_SEARCH_ASSURANCE_REASON_CODES.textOnlyCeiling,
        MODEL_SEARCH_ASSURANCE_REASON_CODES.rankerCeiling,
      ],
    });
  });

  it.each([
    null,
    undefined,
    [],
    {},
    {
      score: Number.NaN,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: Number.POSITIVE_INFINITY,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: -0.01,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 1.01,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: "true",
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "unknown",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "text-only",
      exactMatch: true,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "text-only",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "exact-identifier",
      exactMatch: false,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: true,
      assuranceCeiling: "high",
    },
    {
      score: 0.9,
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "audit-only",
    },
  ])("fails malformed runtime input closed without throwing: %#", (input) => {
    const result = resolveModelSearchAssurance(input);

    expect(result).toEqual({
      valid: false,
      policyVersion: "2026-08-20.v1",
      score: null,
      rawAssurance: "none",
      assurance: "none",
      hardConstraintPass: false,
      evidenceMode: null,
      exactMatch: false,
      declaredAssuranceCeiling: null,
      appliedAssuranceCeiling: "none",
      reasonCodes: [MODEL_SEARCH_ASSURANCE_REASON_CODES.invalidInput],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasonCodes)).toBe(true);
  });

  it("fails closed without invoking accessor properties", () => {
    let getterCalls = 0;
    const input = {
      hardConstraintPass: true,
      evidenceMode: "vision",
      exactMatch: false,
      assuranceCeiling: "high",
    } as Record<string, unknown>;
    Object.defineProperty(input, "score", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 0.9;
      },
    });

    expect(resolveModelSearchAssurance(input)).toMatchObject({
      valid: false,
      assurance: "none",
      reasonCodes: [MODEL_SEARCH_ASSURANCE_REASON_CODES.invalidInput],
    });
    expect(getterCalls).toBe(0);
  });

  it("fails a hostile proxy closed without leaking its exception", () => {
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("untrusted-boundary-error");
        },
      }
    );

    expect(() => resolveModelSearchAssurance(input)).not.toThrow();
    expect(resolveModelSearchAssurance(input)).toMatchObject({
      valid: false,
      assurance: "none",
      reasonCodes: [MODEL_SEARCH_ASSURANCE_REASON_CODES.invalidInput],
    });
  });

  it("returns deeply immutable decisions without mutating caller input", () => {
    const input = Object.freeze({
      score: 0.8,
      hardConstraintPass: true,
      evidenceMode: "multimodal",
      exactMatch: false,
      assuranceCeiling: "high",
    } as const);
    const result = resolveModelSearchAssurance(input);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasonCodes)).toBe(true);
    expect(input).toEqual({
      score: 0.8,
      hardConstraintPass: true,
      evidenceMode: "multimodal",
      exactMatch: false,
      assuranceCeiling: "high",
    });
  });
});
