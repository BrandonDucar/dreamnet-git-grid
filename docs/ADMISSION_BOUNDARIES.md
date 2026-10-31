# Admission and Integrity Boundaries

GitGrid validates repository policy and event payloads before creating an event
file. Index rebuilding validates all parsed events before replacing the index,
and uses those same parsed objects. Invalid or duplicate stored events leave the
previous valid index unchanged. Duplicate content is detected during validation
and index rebuilding, not prevented by `createEvent`.

## Privacy

Key-shape filtering normalizes camelCase, acronym boundaries, Unicode compatibility
forms and separators before checking common secret and direct-contact names.
Secret-shaped fields are forbidden in all repositories; direct-contact fields
are forbidden in public ones. Rejections do not echo the payload value.

This is a heuristic, not complete DLP or classification. Secrets in arbitrary
free-text values, deliberately obfuscated names or unknown aliases can escape it.
Repository visibility alone does not authorize personal-data retention. Review
and redact inputs before calling GitGrid; do not use this filter as the sole
public-disclosure gate or as tenant authorization.

## Integrity

`contentHash` is an unkeyed SHA-256 digest of the canonicalized payload only.
It detects a mismatch, not the identity or honesty of a writer. A writer who edits
the payload and recomputes its hash can produce a valid event. Metadata such as
`sourceRef` is not covered by that digest. GitGrid does not verify an event
signature, trusted author identity, factual accuracy or execution authority.

Git history and review policy supply separate provenance. Signed snapshots or
attestations require an explicitly trusted verifier; merely attaching a signature
is not proof of truth. No such verification is claimed by this patch.

## Local Filesystem

The event write uses exclusive creation. The index write is not atomic or
crash-durable, and there is no repository-wide filesystem lock or snapshot.
Single-read indexing avoids rereading validated events, but does not guarantee
that the repository stays unchanged while it is scanned. Keep writers serialized
at the workflow layer. This library is not a hostile-filesystem sandbox.
