# Storage Policy

## Canonical in Git

- schemas and contracts
- agent, Capsule, and DreamLoop definitions
- source observations with provenance
- claims, disputes, and verification receipts
- sanitized campaign events
- consent and suppression policy versions
- aggregate lead-list snapshots
- hashes and pointers to external evidence

## Canonical outside Git

- secrets and credentials
- live Temporal workflow history
- Redis/NATS transient state
- Docker volumes and package caches
- regulated data requiring guaranteed physical deletion
- very large generated media and raw captures

External objects must still have a Git event containing their URI, content
hash, ownership, retention policy, and evidence classification.

## Sensitive records

Git history is deliberately difficult to erase. Therefore:

- Never commit credentials, seed phrases, private keys, or session tokens.
- Public repos contain no direct phone, email, SSN, or birth-date fields.
- Confidential and restricted records use client-side encrypted objects or
  pointers, with keys stored outside Git.
- A deletion request creates a tombstone event and revokes the corresponding
  decryption key. History rewriting is an exceptional incident procedure.

## Large data

- Keep normal repositories below 1 GB where practical.
- Shard before a repository reaches 5 GB.
- Keep individual Git objects below 50 MiB.
- Use release assets for immutable published bundles.
- Use Git LFS only when its metered storage and bandwidth are intentional.
- Do not use expiring GitHub Actions artifacts as the permanent archive.

## Branch policy

- `main` is canonical.
- Ingestion writes to short-lived branches.
- Pull requests run validation and Cerberus supply-chain checks.
- Event and snapshot paths are append-only after merge.
- Derived indexes may be regenerated and replaced.
- Releases are signed snapshots, not mutable working state.
