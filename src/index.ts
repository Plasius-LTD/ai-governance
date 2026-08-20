export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_GOVERNANCE_PACKAGE = "@plasius/ai-governance";
export const AI_GOVERNANCE_FEATURE_FLAG_ID = "ai.governance.enabled";
export const AI_GOVERNANCE_ENV_PREFIX = "AI_GOVERNANCE";

export const AI_GOVERNANCE_FEATURE_FLAGS = {
  decisions: AI_GOVERNANCE_FEATURE_FLAG_ID,
} as const;

/** Parent rollout flag inherited by the unified model-resolution feature. */
export const MODEL_SEARCH_ASSURANCE_FEATURE_FLAG_ID =
  "asset.pipeline.unified-ai-assets.enabled" as const;

/** Version of the deterministic model-search assurance policy. */
export const MODEL_SEARCH_ASSURANCE_POLICY_VERSION = "2026-08-20.v1" as const;

/** Calibrated score thresholds shared with model-resolution contracts. */
export const MODEL_SEARCH_ASSURANCE_THRESHOLDS = Object.freeze({
  high: 0.75,
  low: 0.5,
} as const);

/** Assurance bands emitted by the model-search policy. */
export const MODEL_SEARCH_ASSURANCE_BANDS = Object.freeze([
  "high",
  "low",
  "none",
] as const);

/** Evidence modes accepted from calibrated model-search rankers. */
export const MODEL_SEARCH_EVIDENCE_MODES = Object.freeze([
  "text-only",
  "vision",
  "multimodal",
  "exact-identifier",
] as const);

/** Stable audit reasons emitted when the policy constrains an assessment. */
export const MODEL_SEARCH_ASSURANCE_REASON_CODES = Object.freeze({
  invalidInput: "model-search-assurance-invalid-input",
  hardConstraintFailed: "hard-constraint-failed",
  textOnlyCeiling: "text-only-assurance-ceiling",
  rankerCeiling: "ranker-assurance-ceiling",
} as const);

export type ModelSearchAssurance =
  (typeof MODEL_SEARCH_ASSURANCE_BANDS)[number];

export type ModelSearchEvidenceMode =
  (typeof MODEL_SEARCH_EVIDENCE_MODES)[number];

export type ModelSearchAssuranceReasonCode =
  (typeof MODEL_SEARCH_ASSURANCE_REASON_CODES)[keyof typeof MODEL_SEARCH_ASSURANCE_REASON_CODES];

/** Validated inputs used to constrain a calibrated model-search score. */
export interface ResolveModelSearchAssuranceInput {
  readonly score: number;
  readonly hardConstraintPass: boolean;
  readonly evidenceMode: ModelSearchEvidenceMode;
  readonly exactMatch: boolean;
  readonly assuranceCeiling: ModelSearchAssurance;
}

/** Successful, immutable assurance decision with the raw score preserved. */
export interface EvaluatedModelSearchAssuranceDecision {
  readonly valid: true;
  readonly policyVersion: typeof MODEL_SEARCH_ASSURANCE_POLICY_VERSION;
  readonly score: number;
  readonly rawAssurance: ModelSearchAssurance;
  readonly assurance: ModelSearchAssurance;
  readonly hardConstraintPass: boolean;
  readonly evidenceMode: ModelSearchEvidenceMode;
  readonly exactMatch: boolean;
  readonly declaredAssuranceCeiling: ModelSearchAssurance;
  readonly appliedAssuranceCeiling: ModelSearchAssurance;
  readonly reasonCodes: readonly ModelSearchAssuranceReasonCode[];
}

/** Fail-closed decision returned for malformed JavaScript/runtime input. */
export interface InvalidModelSearchAssuranceDecision {
  readonly valid: false;
  readonly policyVersion: typeof MODEL_SEARCH_ASSURANCE_POLICY_VERSION;
  readonly score: null;
  readonly rawAssurance: "none";
  readonly assurance: "none";
  readonly hardConstraintPass: false;
  readonly evidenceMode: null;
  readonly exactMatch: false;
  readonly declaredAssuranceCeiling: null;
  readonly appliedAssuranceCeiling: "none";
  readonly reasonCodes: readonly ModelSearchAssuranceReasonCode[];
}

export type ModelSearchAssuranceDecision =
  | EvaluatedModelSearchAssuranceDecision
  | InvalidModelSearchAssuranceDecision;

export type AiGovernanceFeatureFlagKey =
  (typeof AI_GOVERNANCE_FEATURE_FLAGS)[keyof typeof AI_GOVERNANCE_FEATURE_FLAGS];

export type AiGovernanceFeatureFlagSnapshot = Readonly<
  Record<string, boolean | undefined>
>;

const MODEL_SEARCH_ASSURANCE_ORDER: Readonly<
  Record<ModelSearchAssurance, number>
> = Object.freeze({
  none: 0,
  low: 1,
  high: 2,
});

const MODEL_SEARCH_ASSURANCE_INPUT_KEYS = Object.freeze([
  "score",
  "hardConstraintPass",
  "evidenceMode",
  "exactMatch",
  "assuranceCeiling",
] as const);

function isModelSearchAssurance(
  value: unknown
): value is ModelSearchAssurance {
  return MODEL_SEARCH_ASSURANCE_BANDS.includes(
    value as ModelSearchAssurance
  );
}

function isModelSearchEvidenceMode(
  value: unknown
): value is ModelSearchEvidenceMode {
  return MODEL_SEARCH_EVIDENCE_MODES.includes(
    value as ModelSearchEvidenceMode
  );
}

function parseModelSearchAssuranceInput(
  input: unknown
): ResolveModelSearchAssuranceInput | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== MODEL_SEARCH_ASSURANCE_INPUT_KEYS.length ||
    ownKeys.some(
      (key) =>
        typeof key !== "string" ||
        !MODEL_SEARCH_ASSURANCE_INPUT_KEYS.includes(
          key as (typeof MODEL_SEARCH_ASSURANCE_INPUT_KEYS)[number]
        )
    )
  ) {
    return null;
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (
    MODEL_SEARCH_ASSURANCE_INPUT_KEYS.some(
      (key) => descriptors[key] === undefined || !("value" in descriptors[key])
    )
  ) {
    return null;
  }

  const score = descriptors.score!.value as unknown;
  const hardConstraintPass = descriptors.hardConstraintPass!.value as unknown;
  const evidenceMode = descriptors.evidenceMode!.value as unknown;
  const exactMatch = descriptors.exactMatch!.value as unknown;
  const assuranceCeiling = descriptors.assuranceCeiling!.value as unknown;

  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1 ||
    typeof hardConstraintPass !== "boolean" ||
    !isModelSearchEvidenceMode(evidenceMode) ||
    typeof exactMatch !== "boolean" ||
    !isModelSearchAssurance(assuranceCeiling) ||
    exactMatch !== (evidenceMode === "exact-identifier") ||
    (evidenceMode === "text-only" && assuranceCeiling === "high")
  ) {
    return null;
  }

  return {
    score,
    hardConstraintPass,
    evidenceMode,
    exactMatch,
    assuranceCeiling,
  };
}

function deriveRawModelSearchAssurance(
  score: number,
  exactMatch: boolean
): ModelSearchAssurance {
  if (exactMatch || score >= MODEL_SEARCH_ASSURANCE_THRESHOLDS.high) {
    return "high";
  }
  if (score >= MODEL_SEARCH_ASSURANCE_THRESHOLDS.low) {
    return "low";
  }
  return "none";
}

function lowerModelSearchAssurance(
  first: ModelSearchAssurance,
  second: ModelSearchAssurance
): ModelSearchAssurance {
  return MODEL_SEARCH_ASSURANCE_ORDER[first] <=
    MODEL_SEARCH_ASSURANCE_ORDER[second]
    ? first
    : second;
}

function immutableReasonCodes(
  reasonCodes: readonly ModelSearchAssuranceReasonCode[]
): readonly ModelSearchAssuranceReasonCode[] {
  return Object.freeze([...reasonCodes]);
}

function invalidModelSearchAssuranceDecision(): InvalidModelSearchAssuranceDecision {
  return Object.freeze({
    valid: false,
    policyVersion: MODEL_SEARCH_ASSURANCE_POLICY_VERSION,
    score: null,
    rawAssurance: "none",
    assurance: "none",
    hardConstraintPass: false,
    evidenceMode: null,
    exactMatch: false,
    declaredAssuranceCeiling: null,
    appliedAssuranceCeiling: "none",
    reasonCodes: immutableReasonCodes([
      MODEL_SEARCH_ASSURANCE_REASON_CODES.invalidInput,
    ]),
  });
}

/**
 * Apply deterministic hard-gate, evidence, and ranker ceilings to a calibrated
 * model-search score.
 *
 * Malformed runtime input returns an immutable `none` result. The helper never
 * emits an audit-only outcome and never upgrades the supplied score band.
 */
export function resolveModelSearchAssurance(
  input: unknown
): ModelSearchAssuranceDecision {
  let parsed: ResolveModelSearchAssuranceInput | null;
  try {
    parsed = parseModelSearchAssuranceInput(input);
  } catch {
    return invalidModelSearchAssuranceDecision();
  }
  if (parsed === null) {
    return invalidModelSearchAssuranceDecision();
  }

  const rawAssurance = deriveRawModelSearchAssurance(
    parsed.score,
    parsed.exactMatch
  );
  const evidenceCeiling: ModelSearchAssurance =
    parsed.evidenceMode === "text-only" ? "low" : "high";
  const evidenceConstrainedAssurance = lowerModelSearchAssurance(
    rawAssurance,
    evidenceCeiling
  );
  const appliedAssuranceCeiling = lowerModelSearchAssurance(
    evidenceCeiling,
    parsed.assuranceCeiling
  );
  const ceilingConstrainedAssurance = lowerModelSearchAssurance(
    evidenceConstrainedAssurance,
    parsed.assuranceCeiling
  );
  const reasonCodes: ModelSearchAssuranceReasonCode[] = [];

  if (!parsed.hardConstraintPass) {
    reasonCodes.push(
      MODEL_SEARCH_ASSURANCE_REASON_CODES.hardConstraintFailed
    );
  } else {
    if (
      MODEL_SEARCH_ASSURANCE_ORDER[evidenceConstrainedAssurance] <
      MODEL_SEARCH_ASSURANCE_ORDER[rawAssurance]
    ) {
      reasonCodes.push(MODEL_SEARCH_ASSURANCE_REASON_CODES.textOnlyCeiling);
    }
    if (
      MODEL_SEARCH_ASSURANCE_ORDER[ceilingConstrainedAssurance] <
      MODEL_SEARCH_ASSURANCE_ORDER[evidenceConstrainedAssurance]
    ) {
      reasonCodes.push(MODEL_SEARCH_ASSURANCE_REASON_CODES.rankerCeiling);
    }
  }

  return Object.freeze({
    valid: true,
    policyVersion: MODEL_SEARCH_ASSURANCE_POLICY_VERSION,
    score: parsed.score,
    rawAssurance,
    assurance: parsed.hardConstraintPass
      ? ceilingConstrainedAssurance
      : "none",
    hardConstraintPass: parsed.hardConstraintPass,
    evidenceMode: parsed.evidenceMode,
    exactMatch: parsed.exactMatch,
    declaredAssuranceCeiling: parsed.assuranceCeiling,
    appliedAssuranceCeiling,
    reasonCodes: immutableReasonCodes(reasonCodes),
  });
}

export const AI_GOVERNANCE_OUTCOMES = [
  "allow",
  "deny",
  "escalate",
  "redact",
  "audit-only",
] as const;

export type AiGovernanceOutcome =
  (typeof AI_GOVERNANCE_OUTCOMES)[number];

export const AI_GOVERNANCE_DATA_CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "sensitive",
] as const;

export type AiGovernanceDataClassification =
  (typeof AI_GOVERNANCE_DATA_CLASSIFICATIONS)[number];

const AI_GOVERNANCE_CONFIDENCE_THRESHOLDS = {
  redactForSensitiveAllow: 0.4,
  escalateOnLowConfidenceDeny: 0.45,
  escalateOnLowConfidenceRedact: 0.35,
} as const;

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeCodes(reasonCodes: readonly string[]): readonly string[] {
  return reasonCodes.filter((reasonCode) => reasonCode.trim().length > 0);
}

function nowIsoString(): string {
  return new Date().toISOString();
}

export interface AiGovernanceAuditMetadata {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly correlationId: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly outcome: AiGovernanceOutcome;
  readonly evaluatedAtUtc: string;
  readonly confidence: number;
}

export interface ResolveAiGovernanceDecisionInput {
  readonly requestedDecision: AiGovernanceOutcome;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly correlationId: string;
  readonly featureFlags?: AiGovernanceFeatureFlagSnapshot;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly confidence?: number;
  readonly dataClassification?: AiGovernanceDataClassification;
  readonly reasonCodes?: readonly string[];
}

export interface ResolveAiGovernanceDecisionResult {
  readonly requestedDecision: AiGovernanceOutcome;
  readonly outcome: AiGovernanceOutcome;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly confidence: number;
  readonly dataClassification: AiGovernanceDataClassification;
  readonly reasonCodes: readonly string[];
  readonly source: "default" | "feature-disabled" | "policy";
  readonly enabledFeatureFlags: readonly AiGovernanceFeatureFlagKey[];
  readonly audit: AiGovernanceAuditMetadata;
}

function isAiGovernanceFeatureEnabled(
  featureFlag: AiGovernanceFeatureFlagKey,
  snapshot: AiGovernanceFeatureFlagSnapshot = {}
): boolean {
  return snapshot[featureFlag] === true;
}

export function resolveAiGovernanceDecision(
  input: ResolveAiGovernanceDecisionInput
): ResolveAiGovernanceDecisionResult {
  const normalizedConfidence = clampRatio(input.confidence ?? 0);
  const classification = input.dataClassification ?? "public";
  const reasonCodes = [
    ...normalizeCodes(input.reasonCodes ?? []),
  ] as string[];

  const featureFlags = input.featureFlags ?? {};
  const featureEnabled = isAiGovernanceFeatureEnabled(
    AI_GOVERNANCE_FEATURE_FLAGS.decisions,
    featureFlags
  );
  const enabledFeatureFlags: AiGovernanceFeatureFlagKey[] = featureEnabled
    ? [AI_GOVERNANCE_FEATURE_FLAGS.decisions]
    : [];

  if (!featureEnabled) {
    reasonCodes.push("governance-feature-disabled");
    return {
      requestedDecision: input.requestedDecision,
      outcome: "audit-only",
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      confidence: normalizedConfidence,
      dataClassification: classification,
      reasonCodes,
      source: "feature-disabled",
      enabledFeatureFlags,
      audit: {
        policyId: input.policyId,
        policyVersion: input.policyVersion,
        correlationId: input.correlationId,
        requestId: input.requestId,
        actorId: input.actorId,
        outcome: "audit-only",
        evaluatedAtUtc: nowIsoString(),
        confidence: normalizedConfidence,
      },
    };
  }

  let outcome: AiGovernanceOutcome = input.requestedDecision;
  const policySource: ResolveAiGovernanceDecisionResult["source"] = "policy";

  if (
    input.requestedDecision === "allow" &&
    classification === "sensitive" &&
    normalizedConfidence < AI_GOVERNANCE_CONFIDENCE_THRESHOLDS.redactForSensitiveAllow
  ) {
    outcome = "redact";
    reasonCodes.push("low-confidence-sensitive-content");
  }

  if (
    input.requestedDecision === "deny" &&
    normalizedConfidence < AI_GOVERNANCE_CONFIDENCE_THRESHOLDS.escalateOnLowConfidenceDeny
  ) {
    outcome = "escalate";
    reasonCodes.push("low-confidence-denial-escalated");
  }

  if (
    input.requestedDecision === "redact" &&
    normalizedConfidence < AI_GOVERNANCE_CONFIDENCE_THRESHOLDS.escalateOnLowConfidenceRedact
  ) {
    outcome = "escalate";
    reasonCodes.push("low-confidence-redaction-escalated");
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push(
      outcome === "audit-only" ? "governance-defaulted-to-audit" : "governance-policy-pass"
    );
  }

  return {
    requestedDecision: input.requestedDecision,
    outcome,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    confidence: normalizedConfidence,
    dataClassification: classification,
    reasonCodes,
    source: policySource,
    enabledFeatureFlags,
    audit: {
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      correlationId: input.correlationId,
      requestId: input.requestId,
      actorId: input.actorId,
      outcome,
      evaluatedAtUtc: nowIsoString(),
      confidence: normalizedConfidence,
    },
  };
}

/**
 * Return whether processing may continue for an outcome.
 *
 * `audit-only` is deliberately non-enforcing: it permits processing without
 * applying redaction or another policy control. Callers that require an
 * enforced privacy control must inspect the concrete outcome as well.
 */
export function isAiGovernanceOutcomeAllowed(
  outcome: AiGovernanceOutcome
): outcome is "allow" | "redact" | "audit-only" {
  return (
    outcome === "allow" ||
    outcome === "redact" ||
    outcome === "audit-only"
  );
}

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_GOVERNANCE_PACKAGE,
  featureFlagId: AI_GOVERNANCE_FEATURE_FLAG_ID,
  envPrefix: AI_GOVERNANCE_ENV_PREFIX,
  summary: "AI guardrail, policy decision, confidence, and audit contracts for Plasius agentic AI.",
});
