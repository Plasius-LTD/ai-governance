export interface AiPackageDescriptor {
  readonly packageName: string;
  readonly featureFlagId: string;
  readonly envPrefix: string;
  readonly summary: string;
}

export const AI_GOVERNANCE_PACKAGE = "@plasius/ai-governance";
export const AI_GOVERNANCE_FEATURE_FLAG_ID = "ai.governance.enabled";
export const AI_GOVERNANCE_ENV_PREFIX = "AI_GOVERNANCE";

export const packageDescriptor: AiPackageDescriptor = Object.freeze({
  packageName: AI_GOVERNANCE_PACKAGE,
  featureFlagId: AI_GOVERNANCE_FEATURE_FLAG_ID,
  envPrefix: AI_GOVERNANCE_ENV_PREFIX,
  summary: "AI guardrail, policy decision, confidence, and audit contracts for Plasius agentic AI.",
});
