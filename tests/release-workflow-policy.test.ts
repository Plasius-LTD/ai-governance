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
const selfHostedWorkflowPath = resolve(
  process.cwd(),
  ".github/workflows/ci-self-hosted.yml",
);
const selfHostedWorkflow = existsSync(selfHostedWorkflowPath)
  ? readFileSync(selfHostedWorkflowPath, "utf8")
  : "";
const workflowRepository = ["Plasius", "LTD/ai-governance"].join("-");

describe("npm release trust boundary", () => {
  it("admits same-repository pull requests through the approved reusable workflow", () => {
    expect(existsSync(selfHostedWorkflowPath)).toBe(true);
    expect(ciWorkflow).toContain("pull_request:\n    branches: [main]");
    expect(ciWorkflow).toContain("workflow_dispatch:");
    expect(ciWorkflow).toContain(
      "self-hosted-validation:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}\n    uses: " +
        workflowRepository +
        "/.github/workflows/ci-self-hosted.yml@main",
    );
    expect(selfHostedWorkflow).toContain("on:\n  workflow_call:");
    expect(selfHostedWorkflow).toContain(
      "build-test:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}",
    );
    expect(
      selfHostedWorkflow.match(
        /runs-on:\n {6}group: Public CI - Quarantined\n {6}labels: \[self-hosted, Linux, X64\]/gu,
      ),
    ).toHaveLength(1);
    expect(selfHostedWorkflow).toContain("run: npm run pack:check");
    expect(ciWorkflow).not.toContain("runs-on:");
    expect(ciWorkflow).not.toContain("CI_RUNNER_LABELS");
    expect(ciWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toContain("pull_request_target");
    expect(selfHostedWorkflow).not.toContain("ubuntu-latest");
    expect(selfHostedWorkflow).not.toContain("workflow_call:\n    inputs:");
    expect(selfHostedWorkflow).not.toContain("${{ inputs.");
    expect(selfHostedWorkflow).not.toMatch(/runs-on:\s*\$\{\{/u);
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
