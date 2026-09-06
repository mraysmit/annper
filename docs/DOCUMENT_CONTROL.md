# GDFramework Migration Document Control

**Status:** Controlled working baseline  
**Control date:** 6 September 2026

## 1. Authority and precedence

| Precedence | Artifact | Authority |
|---:|---|---|
| 1 | `GDFramework Functional Specification.md` | Normative observable behavior, functional scope, compatibility contract, and legacy defect evidence |
| 2 | `MIGRATION_MASTER.md` | Governance, architecture boundaries, delivery sequence, decision points, risks, and quality gates |
| 3 | Approved ADRs under `docs/adr` | One approved technical decision within the boundaries of the first two documents |
| 4 | Supporting inventories and matrices | Controlled evidence and implementation/test status |
| 5 | Files under `docs/archive` | Superseded historical context only; never normative |

An ADR or migration-plan statement may not silently override a functional
requirement. A deliberate behavior change requires:

1. an approved `preserve`, `fix`, or `retire` disposition;
2. the affected requirement and test rows updated in the traceability matrix;
3. an ADR when architecture or compatibility is affected; and
4. a new controlled document version.

## 2. Status vocabulary

| Status | Meaning |
|---|---|
| Working | Actively edited and not suitable as a gate baseline |
| Controlled working baseline | Versioned and internally checked; external evidence or approval remains outstanding |
| Approved baseline | Named approvers accepted the defined scope and evidence |
| Superseded | Retained for history only and replaced by a named later version |
| Archived | Frozen historical evidence; no further edits |

“Controlled” does not mean the deployed application is fully specified. The
functional specification's completeness boundary remains binding.

## 3. Document register

| Document | Version/status | Owner role | Approval required from |
|---|---|---|---|
| Functional specification | 0.4 / controlled working baseline | Product/domain owner | Product, legacy technical, test/quality |
| Migration master | 0.3 / controlled working baseline | Migration technical lead | Product, security, database, operations, test/quality |
| Requirement traceability | Generated working matrix | Test/quality owner | Owners of linked evidence and tests |
| Non-functional requirements | 0.1 / provisional acceptance floor | Migration technical lead | Product, security, operations, UI/workflow |
| Legacy baseline and inventories | 0.1 / initial repository snapshot | Legacy technical owner | Legacy technical and operations |
| Defect dispositions | Generated / approval pending | Product/domain owner | Product, security, and affected technical owner |

Named people and approval dates shall replace role placeholders during Phase 0.

## 4. Portable evidence-root convention

`LEGACY_SOURCE_ROOT` means the root of the read-only legacy GDFramework tree.
All functional-specification paths are resolved from
`${LEGACY_SOURCE_ROOT}/Docs` because they were originally recorded relative to
that folder. The sibling GUI tree is `${LEGACY_SOURCE_ROOT}/../GenData/AppGUI`.

The path used during the 6 September 2026 control pass was:

`\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework`

This is evidence about the reviewed instance, not a required path for another
developer or build agent.

## 5. Version and change rules

- Patch version: clarification or evidence-link repair with no behavior change.
- Minor version: added/changed requirements, dispositions, architecture, or gate
  logic.
- Major version: approved scope or compatibility baseline changes materially.
- Every version records date, summary, author/owner, approvers, and the legacy
  checksum-manifest identity.
- Generated inventories are reproducible outputs; edit their generator or source
  evidence rather than hand-editing generated rows.

## 6. Change history

| Date | Artifact/version | Change | Approval state |
|---|---|---|---|
| 2026-07-31 | Design 0.1; Plan 0.1 | Initial separate design and delivery drafts | Superseded |
| 2026-08-01 | Migration master 0.2 | Consolidated design and plan | Superseded by 0.3 |
| 2026-08-01 | Functional specification 0.3 | Repository, source-lineage, control, and UI-integration audit | Superseded by 0.4 |
| 2026-09-06 | Migration master 0.3 | Corrected authority, gates, portability, technology neutrality, risks, and controlled artifacts | Controlled; approval pending |
| 2026-09-06 | Functional specification 0.4 | Clarified full framework scope, portability, baseline identity, NFRs, and traceability | Controlled; approval pending |

## 7. Approval record

| Role | Name | Decision | Date |
|---|---|---|---|
| Product/domain owner | Unassigned | Pending | — |
| Legacy technical owner | Unassigned | Pending | — |
| Migration technical lead | Unassigned | Pending | — |
| Database owner | Unassigned | Pending | — |
| Security owner | Unassigned | Pending | — |
| Operations owner | Unassigned | Pending | — |
| Test/quality owner | Unassigned | Pending | — |
| UI/workflow owner | Unassigned | Pending | — |

