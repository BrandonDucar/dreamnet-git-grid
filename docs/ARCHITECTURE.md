# Architecture

## Control plane

`dreamnet-git-grid` publishes the schemas, validation rules, and CLI used by
every participating repository.

Each data repository owns one bounded object type or vertical. A registry can
discover participating repositories through a GitHub topic and their
`.dreamnet/repo.json` manifests.

## Data plane

```text
Approved source
  -> immutable observation event
  -> deterministic content hash
  -> pull request
  -> GitGrid validation
  -> human or policy approval
  -> main branch
  -> derived indexes and projections
  -> release snapshot / Proof Drop
```

## Runtime plane

Git is intentionally not used for:

- sub-second coordination
- queue leases
- long-running timers
- secret storage
- high-churn counters
- arbitrary SQL joins

Temporal owns durable workflow execution. NATS and Redis may carry transient
messages. PGLite, Postgres, Graphiti, and search engines are projections that
can be rebuilt from canonical events.

## Repository topology

Prefer one repository per bounded business asset, not one repository per row.

Good:

```text
vanguard54-precious-metals-intelligence
vanguard54-marine-contractors
memory-weaver-public-claims
dreamnet-agent-competency-receipts
```

Bad:

```text
lead-000001
lead-000002
lead-000003
```

Events are sharded by UTC date to keep directory width below GitHub's
recommended operational limits:

```text
events/2026/07/28/<event-id>.json
```

When a day approaches 3,000 files, add an hour shard:

```text
events/2026/07/28/13/<event-id>.json
```

## Cross-repository retrieval

Agents should use, in order:

1. The GitHub API or `gh` for manifests and recent objects.
2. Sparse checkout for a known path.
3. Partial clone with `--filter=blob:none` for deeper history.
4. A local, disposable index for full-text, graph, or vector retrieval.

The index stores each source repository, commit SHA, path, and content hash so
answers remain traceable to Git.
