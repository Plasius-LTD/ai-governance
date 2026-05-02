# ADR-0001: @plasius/ai-governance Package Boundary

- Date: 2026-05-02
- Status: Accepted

## Context

The agentic AI package family needs focused package boundaries so provider configuration, routing, speech, governance, MCP, RAG, game logic, and evaluation concerns can evolve independently without turning `@plasius/ai` into a catch-all runtime package.

## Decision

Create `@plasius/ai-governance` as a standalone public package with independent build, test, governance, and publish readiness. The package starts with a narrow descriptor contract and will receive implementation through tracked Feature/Story/Task work.

## Consequences

- The package can be versioned and released independently.
- Consumers can adopt only the AI layer they need.
- Future implementation must preserve the package boundary documented here.
- Runtime secrets, provider credentials, and product-specific data remain outside the public package surface.
