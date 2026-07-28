# Primo + Antigravity Handoff

DreamNet GitGrid is a repository contract for durable agent knowledge, evidence,
datasets, and business assets. Primo's Antigravity can use it directly because
the repository is public and has no service credential requirement.

## Start

```bash
git clone https://github.com/BrandonDucar/dreamnet-git-grid.git
cd dreamnet-git-grid
npm test
node bin/git-grid.mjs validate .
```

GitGrid has no runtime dependencies. `npm test` uses Node's built-in test runner,
so no package installation is required.

## What Antigravity Should Read

1. `.dreamnet/repo.json` identifies the repository's purpose and data policy.
2. `schemas/event.schema.json` defines durable event records.
3. `schemas/repo-manifest.schema.json` defines the repository contract.
4. `docs/STORAGE_POLICY.md` explains what belongs in Git and what does not.
5. `docs/RECEIPT_ROUTING.md` defines green, yellow, orange, and red security
   branches.
6. [DreamNet Claim Factory](https://github.com/BrandonDucar/dreamnet-claim-factory)
   defines credentialed producer and independent verifier factories.

## Working Model

```text
bounded assignment
  -> branch
  -> event, factory claim, verification report, receipt, or artifact
  -> local validation
  -> Cerberus gate when executable material is involved
  -> pull request
  -> review
  -> merge
  -> optional database or search projection
```

Git is canonical. A database, vector store, graph, or search index is a
rebuildable projection unless a product explicitly declares otherwise.

## Good First Uses

- A research library with source-linked claims.
- A scraper vertical with immutable provenance events.
- Agent competency and ToolGym receipts.
- Product decisions and release evidence.
- A private customer knowledge repository using encrypted pointers.

Do not create one repository per row. Create one repository per bounded asset,
customer boundary, product, vertical, or independently governed corpus.

## Safety Rules

- Never commit secrets, API keys, wallet keys, or authentication cookies.
- Never place direct personal contact data in a public repository.
- Use encrypted, revocable pointers for confidential or restricted material.
- Run Cerberus before installing or executing an unfamiliar repository.
- Yellow, orange, and red Cerberus receipts block execution.
- Use pull requests; do not allow agents to write directly to protected branches.

## Suggested Antigravity Assignment

> Read this repository as an operating contract. Validate it without installing
> dependencies. Inventory my current projects and identify one bounded knowledge
> asset that would benefit from append-only events, provenance, receipts, and
> rebuildable indexes. Propose a migration through a draft pull request. Do not
> move secrets or direct PII. Run DreamNet Cerberus before executing third-party
> code, and stop on yellow, orange, or red.
