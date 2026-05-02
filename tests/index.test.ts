import { describe, expect, it } from "vitest";

import {
  AI_GOVERNANCE_ENV_PREFIX,
  AI_GOVERNANCE_FEATURE_FLAG_ID,
  AI_GOVERNANCE_PACKAGE,
  packageDescriptor,
} from "../src/index.js";

describe("@plasius/ai-governance", () => {
  it("exports the package descriptor contract", () => {
    expect(packageDescriptor.packageName).toBe(AI_GOVERNANCE_PACKAGE);
    expect(packageDescriptor.featureFlagId).toBe(AI_GOVERNANCE_FEATURE_FLAG_ID);
    expect(packageDescriptor.envPrefix).toBe(AI_GOVERNANCE_ENV_PREFIX);
    expect(packageDescriptor.summary.length).toBeGreaterThan(0);
  });
});
