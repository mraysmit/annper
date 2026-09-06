# GDFramework Migration

This repository is the planning and implementation workspace for replacing the
legacy VB6 GDFramework codebase.

The migration is documentation-first. No replacement implementation may be
treated as conformant until the applicable functional requirements, decisions,
and phase exit criteria have approved evidence.

## Controlled document hierarchy

1. [Functional specification](docs/GDFramework%20Functional%20Specification.md)
   is normative for observable behavior, compatibility, and functional scope.
2. [Modern web system design](docs/MODERN_WEB_SYSTEM_DESIGN.md) is normative for
   the target web architecture and implementation boundaries.
3. [Migration master plan and design](docs/MIGRATION_MASTER.md) is normative for
   governance, architecture, sequencing, and quality gates. It may not silently
   override a functional requirement.
4. Approved records under `docs/adr` govern individual technical decisions.
5. [Document control](docs/DOCUMENT_CONTROL.md) defines approval, versioning,
   precedence, and change history for the set.

Supporting controlled artifacts:

- [Requirement traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Non-functional requirements](docs/NON_FUNCTIONAL_REQUIREMENTS.md)
- [Legacy baseline](docs/LEGACY_BASELINE.md)
- [Component inventory](docs/COMPONENT_INVENTORY.md)
- [Dependency inventory](docs/DEPENDENCY_INVENTORY.md)
- [Public API catalogue](docs/PUBLIC_API_CATALOG.md)
- [Dataset catalogue](docs/DATASET_CATALOG.md)
- [Provider matrix](docs/PROVIDER_MATRIX.md)
- [Legacy defect dispositions](docs/DEFECT_DISPOSITION.md)
- [Deployed-application evidence acquisition](docs/EVIDENCE_ACQUISITION.md)

The original 0.1 drafts are retained under `docs/archive` for historical
traceability only.

## Source system

Set `LEGACY_SOURCE_ROOT` to the root of the read-only legacy GDFramework source.
The reviewed snapshot was accessed at
`\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework`;
that machine path is evidence context, not a repository dependency.

It is the behavioral reference during discovery and characterization. It
should not be modified merely to make the replacement easier unless a
separately approved stabilization change is required.

## Current status

- Functional specification: Controlled working baseline 0.5; framework and
  metadata-schema scope complete, deployed row/runtime expansion pending
- Modern web system design: Controlled working baseline 0.1; complete logical
  target design, concrete technology ADRs pending
- Consolidated design and plan: Controlled working baseline 0.4
- Phase 0: Started; source control and initial baseline artifacts established
- Replacement code: Not started
- Target UI: Modern web application selected; implementation framework pending
- Deployment topology: Not decided
