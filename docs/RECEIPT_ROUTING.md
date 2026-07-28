# Receipt Routing

A security receipt is a workflow decision, not a passive report. The receipt is
bound to an exact artifact digest and source commit. A different commit requires
a different receipt.

## Routes

| Verdict | Execution | Route | Required outcome |
| --- | --- | --- | --- |
| Green | Allowed | Admit | Continue the bounded assignment |
| Yellow | Blocked | Remediate | Quarantine, review, repair, and rescan |
| Red | Blocked | Incident | Isolate, revoke temporary access, alert, and investigate |
| Missing or unknown | Blocked | Incident | Fail closed as an unverifiable artifact |

## Green

Green admits only the exact scanned artifact. It does not grant permanent trust
to the repository, author, package name, branch, or future commits.

The workflow records the receipt digest, source commit, admitted task, policy
version, operator identity, and expiration or rescan condition.

## Yellow

Yellow creates a remediation branch:

1. Stop installation and execution.
2. Place the artifact in a non-executing quarantine location.
3. Create a remediation task linked to every finding.
4. Expand the review quorum based on affected risk domains.
5. Produce a patch on a new branch or reject the dependency.
6. Run Cerberus against the replacement commit.
7. Resume only when a new green receipt is issued.

Yellow cannot be waived by editing the receipt. A permitted policy exception is
a separately signed, expiring artifact with a human owner.

## Red

Red creates an incident branch:

1. Abort the active assignment.
2. Isolate the artifact and any derived output.
3. Revoke temporary credentials, tokens, mounts, and network grants it received.
4. Preserve logs and hashes without executing the suspect artifact again.
5. Generate an incident Proof Drop.
6. Notify the designated human and security agents.
7. Search lineage for downstream artifacts derived from the blocked digest.
8. Require human approval and a newly scanned commit before re-entry.

Red never triggers automatic repair inside a privileged environment.

## Temporal Contract

The Receipt Router is idempotent on `receipt_digest + policy_version`. Replayed
receipts return the existing route decision and do not create duplicate issues,
alerts, revocations, or Proof Drops.

```text
Cerberus receipt
       |
       v
Temporal Receipt Router
  |        |        |
green    yellow     red
  |        |        |
admit   remediate  incident
```

Every branch writes a GitGrid event. Large logs and binaries live in approved
artifact storage and are referenced by digest rather than committed directly.

## Re-entry

An artifact may re-enter only when all of these are true:

- remediation produced a new immutable commit or digest,
- Cerberus issued a green receipt for that exact artifact,
- required reviews and approvals are complete,
- revoked access is reissued with fresh scope,
- the original yellow or red receipt remains preserved as lineage evidence.
