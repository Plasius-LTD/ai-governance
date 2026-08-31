import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/cd.yml"),
  "utf8",
);
const ciWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);
const hostedWorkflowPath = resolve(
  process.cwd(),
  ".github/workflows/ci-hosted.yml",
);
const hostedWorkflow = existsSync(hostedWorkflowPath)
  ? readFileSync(hostedWorkflowPath, "utf8")
  : "";

describe("npm release trust boundary", () => {
  it("admits same-repository pull requests through exact-revision hosted validation", () => {
    expect(existsSync(hostedWorkflowPath)).toBe(true);
    expect(ciWorkflow).toContain("pull_request:\n    branches: [main]");
    expect(ciWorkflow).toContain("workflow_dispatch:");
    expect(ciWorkflow).toContain(
      "hosted-validation:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}\n    uses: ./.github/workflows/ci-hosted.yml",
    );
    expect(hostedWorkflow).toContain("on:\n  workflow_call:");
    expect(hostedWorkflow).toContain(
      "build-test:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}",
    );
    expect(hostedWorkflow).toContain("runs-on: ubuntu-latest");
    expect(hostedWorkflow).toContain("package-manager-cache: false");
    expect(hostedWorkflow).toContain("run: npm run pack:check");
    expect(ciWorkflow).not.toContain("runs-on:");
    expect(ciWorkflow).not.toContain("CI_RUNNER_LABELS");
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(hostedWorkflow).not.toContain("pull_request_target");
    expect(hostedWorkflow).not.toContain("self-hosted");
    expect(hostedWorkflow).not.toContain("workflow_call:\n    inputs:");
    expect(hostedWorkflow).not.toContain("${{ inputs.");
    expect(hostedWorkflow).not.toMatch(/runs-on:\s*\$\{\{/u);
    expect(ciWorkflow).not.toContain("@main");
  });

  it("uses hosted OIDC publication without a long-lived npm write token", () => {
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm publish");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
  });

  it("admits only the prepared main commit after exact successful CI", () => {
    expect(workflow).toContain("Enforce exact-main successful CI");
    expect(workflow).toContain("needs.prepare_release.outputs.commit_sha");
    expect(workflow).toContain("refs/remotes/origin/main");
    expect(workflow).toContain("-f branch=main");
    expect(workflow).toContain("-f event=push");
    expect(workflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(workflow).toContain("conclusion == \"success\"");
  });

  it("fails closed when the release runtime cannot use npm OIDC", () => {
    expect(workflow).toContain("Verify release runtime");
    expect(workflow).toContain('ACTUAL_NODE%%.*');
    expect(workflow).toContain('"11.5.1"');
    expect(workflow).toContain("--provenance");
  });
});
