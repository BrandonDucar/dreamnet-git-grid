# DreamNet GitGrid

GitGrid turns GitHub repositories into a durable, versioned knowledge and asset
ledger for DreamNet.

It is designed for:

- scraped source observations
- lead and market intelligence
- claims and counterclaims
- agent definitions and competency receipts
- campaign events
- Proof Drop manifests
- research and memory snapshots

Git is the canonical record. Local databases, search engines, PGLite, Graphiti,
and warehouse tables are rebuildable projections.

GitGrid does not pretend Git is a job queue or a low-latency database. Temporal
owns active workflow history, retries, timers, and task queues. Redis and NATS
may carry transient coordination. GitGrid records the durable inputs, outputs,
provenance, policy, and receipts.

## Why this works

- Every change has an author, timestamp, commit, and diff.
- Immutable event files make tampering and accidental rewrites visible.
- Content hashes provide stable deduplication keys.
- GitHub Actions validate every contribution before merge.
- Sparse and partial clones let agents retrieve only the relevant vertical.
- Releases freeze valuable data products without bloating normal clones.
- A local index can always be rebuilt from repository state.

## Five-minute setup

```bash
git clone https://github.com/BrandonDucar/dreamnet-git-grid.git
cd dreamnet-git-grid
npm test
node bin/git-grid.mjs validate .
```

To initialize another repository:

```bash
node bin/git-grid.mjs init ../my-data-repo \
  --repo-id dreamnet://vanguard54/precious-metals \
  --object-type lead-intelligence \
  --visibility private
```

To create a content-addressed event:

```bash
node bin/git-grid.mjs event ../my-data-repo \
  --event-type source.observed \
  --source https://example.gov/record/123 \
  --evidence-mode LIVE_SOURCE \
  --payload ./observation.json
```

Then validate:

```bash
node bin/git-grid.mjs validate ../my-data-repo
```

## Repository contract

Every participating repository contains:

```text
.dreamnet/repo.json       Repository identity, policy, and ownership
events/YYYY/MM/DD/        Immutable event objects
snapshots/                Named, signed data-product snapshots
indexes/                  Derived and replaceable search indexes
receipts/                 Sanitized execution and verification receipts
```

The schemas live in [`schemas/`](schemas/). A starter manifest lives in
[`templates/repo-manifest.json`](templates/repo-manifest.json).

## Privacy boundary

Public repositories may contain only `PUBLIC`, `AGGREGATE`, or `SYNTHETIC`
records. GitGrid rejects common direct-contact and secret fields in public event
payloads.

Private repositories are not a license to retain sensitive data forever.
`CONFIDENTIAL` and `RESTRICTED` records must use encrypted objects or pointers
whose decryption keys can be revoked. Secrets never belong in Git.

See [Storage Policy](docs/STORAGE_POLICY.md) for the full placement rules.

## Current status

GitGrid v0.1 provides:

- repository initialization
- content-addressed event creation
- repository and event validation
- public-data privacy gates
- append-only diff validation
- deterministic index generation
- zero runtime dependencies

## License

Apache-2.0.
