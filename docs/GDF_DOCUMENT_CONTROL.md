# GDFramework Migration Document Control

**Status:** Controlled working baseline
**Version:** 0.12
**Control date:** 12 October 2026
**Owner:** Test/quality owner
**Legacy checksum-manifest SHA-256:** `fc29779b9588a41cb9da10c486f1f0b35ca2108baf50fb8892086587ee320027`

## 1. Authority and precedence

The controlled baseline consists of five documents. Working guides and
generated artifacts may live beside them, but they are not additional sources
of policy.

| Precedence | Artifact | Authority |
|---:|---|---|
| 1 | `GDFramework Functional Specification.md` | Observable behavior, functional scope, compatibility, NFRs, and defect dispositions |
| 2 | `GDF_MODERN_WEB_SYSTEM_DESIGN.md` | Target architecture, implementation boundaries, and `WDES-*` requirements |
| 3 | `GDF_MIGRATION_MASTER.md` | Current position, governance, delivery sequence, decisions, risks, gates, and reference-baseline pointers |
| 4 | `GDF_ARCHITECTURE_DECISIONS.md` | Approved decision rationale, consequences, validation, and named approvals |
| 5 | `GDF_DOCUMENT_CONTROL.md` | Document versions, precedence, change rules, and baseline approval |

The generated [requirements traceability matrix](GDF_REQUIREMENTS_TRACEABILITY.md)
maps controlled IDs to evidence, tests, phases, and current status. It derives
from the functional specification and design and cannot override either one.

An ADR governs one decision within the boundaries of the functional
specification and design. The migration master section 7 owns live decision
status and timing. A deliberate behavioral change requires:

1. an approved defect disposition or product decision;
2. an ADR when architecture or compatibility is affected;
3. regenerated traceability; and
4. new versions of every affected controlled document.

Desktop-bound behavior is governed by functional specification section 32.1,
D-017, and ADR-002. Superseded documents and expanded historical commentary
remain available in git history rather than in the live baseline.

## 2. Status vocabulary

| Status | Meaning |
|---|---|
| Working | Actively edited and not suitable as gate evidence |
| Controlled working baseline | Versioned and internally checked; final baseline approval remains outstanding |
| Approved baseline | The required owners accepted the scope and evidence |
| Generated controlled artifact | Deterministic output from controlled sources; never edited directly |
| Superseded | Replaced by a named later version and retained in git history |

“Controlled” does not mean that an authored application is complete. The
functional specification and migration-master gates define completeness.

## 3. Document register

| Document | Version/status | Owner | Required baseline approval |
|---|---|---|---|
| Functional specification | 0.13 / controlled working baseline | Product/domain owner | Product, legacy technical, security, test/quality |
| Modern web system design | 0.12 / controlled working design baseline | Migration technical lead | Product, security, database, operations, UI/workflow, test/quality |
| Migration master | 0.15 / controlled working baseline | Migration technical lead | Product, security, database, operations, legacy technical, test/quality |
| Architecture decision records | 0.1 / controlled working baseline | Migration technical lead | Owners named by each ADR |
| Document control | 0.12 / controlled working baseline | Test/quality owner | Owners of linked evidence and tests |

### 3.1 Derived and working artifacts

| Artifact | Classification | Control rule |
|---|---|---|
| `GDF_REQUIREMENTS_TRACEABILITY.md` | Generated controlled artifact | Regenerate with `tools/Build-ControlledArtifacts.ps1`; do not hand-edit |
| `GDF_DEPLOYMENT_GUIDE.md` | Working guide | Controlled documents govern if wording differs |
| `../baseline/legacy-file-inventory.csv` | Generated evidence | Regenerate only from the reviewed source root |
| `../baseline/legacy-source.sha256` | Generated evidence | Contents identify the reviewed snapshot |
| `../baseline/legacy-source-manifest.sha256` | Generated evidence | Its SHA-256 identity appears in every controlled-document header |

## 4. Portable evidence-root convention

`LEGACY_SOURCE_ROOT` means the root of the read-only legacy GDFramework tree.
Functional-specification source paths resolve from
`${LEGACY_SOURCE_ROOT}/Docs`; the sibling GUI tree is
`${LEGACY_SOURCE_ROOT}/../GenData/AppGUI`.

Tools accept the evidence root only through that environment variable or an
explicit parameter. When it is unavailable, generation reuses the committed
checksum baseline and validation reports the source-path check as skipped. The
reviewed network location appears only in migration master section 9.1 as
evidence about the captured copy, never as a build dependency.

## 5. Version and change rules

- A clarification or link repair increments the document's working version.
- A behavior, disposition, architecture, or gate change also requires review
  by the owners of the affected authority.
- A materially changed approved scope requires a new major baseline.
- Each controlled header, this register, README current status, and the current
  change-history row must agree.
- Functional, NFR, defect, or design-verification changes require regeneration
  of `GDF_REQUIREMENTS_TRACEABILITY.md`.
- Defect decisions remain in functional specification section 31 so generation
  cannot discard them.
- Superseded versions are not copied into the live documents. Git history is
  the detailed archive.

## 6. Current change history

This table records the current baseline lineage only. Earlier 0.x iteration
detail remains in git history, including the superseded design and plan drafts
last present at commit `bb1991a`.

| Date | Versions | Change | Approval state |
|---|---|---|---|
| 2026-10-10 | Functional 0.12; design 0.10; master 0.13; control 0.10 | Approved D-011 defect policy and all 38 dispositions, D-017 web reinterpretations, D-020 exclusions, D-005 sign-in, D-004/D-013 neutrality, D-022 application access, and D-023 Studio access through ADR-001..ADR-008 | Decisions approved; document baseline pending |
| 2026-10-11 | Design 0.11; master 0.14; control 0.11 | Clarified rollback of application roles/users and registered D-024 environment promotion | Controlled working baselines |
| 2026-10-12 | Functional 0.13; design 0.12; master 0.15; ADRs 0.1; control 0.12 | Reduced the master and document control to their governing purposes; separated condensed ADRs; moved the generated traceability matrix to its own artifact; corrected stale status and links; changed no product behavior or architecture decision | Controlled working baselines |

## 7. Approval record

| Role | Name | Baseline decision | Date |
|---|---|---|---|
| Product/domain owner | Mark Raysmith | Pending | — |
| Legacy technical owner | Mark Raysmith | Pending | — |
| Migration technical lead | Mark Raysmith | Pending | — |
| Database owner | Mark Raysmith | Pending | — |
| Security owner | Mark Raysmith | Pending | — |
| Operations owner | Mark Raysmith | Pending | — |
| Test/quality owner | Mark Raysmith | Pending | — |
| UI/workflow owner | Mark Raysmith | Pending | — |

This approval covers the five controlled documents as a baseline. Individual
decisions already approved on 10 October 2026 retain their approvals in
`GDF_ARCHITECTURE_DECISIONS.md` and functional specification sections 31 and
32.1.
