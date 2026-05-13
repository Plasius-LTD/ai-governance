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

export type AiGovernanceFeatureFlagKey =
  (typeof AI_GOVERNANCE_FEATURE_FLAGS)[keyof typeof AI_GOVERNANCE_FEATURE_FLAGS];

export type AiGovernanceFeatureFlagSnapshot = Readonly<
  Record<string, boolean | undefined>
>;

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

const AI_GOVERNANCE_OUTCOME_INDEX = Object.fromEntries(
  AI_GOVERNANCE_OUTCOMES.map((outcome, index) => [outcome, index + 1])
) as Record<AiGovernanceOutcome, number>;

const AI_GOVERNANCE_CONFIDENCE_THRESHOLDS = {
  redactForSensitiveAllow: 0.4,
  escalateOnLowConfidenceDeny: 0.45,
  keepRedactionOnLowConfidenceRedact: 0.35,
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
    normalizedConfidence < AI_GOVERNANCE_CONFIDENCE_THRESHOLDS.keepRedactionOnLowConfidenceRedact
  ) {
    outcome = "audit-only";
    reasonCodes.push("redaction-disabled-for-unreliable-input");
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
