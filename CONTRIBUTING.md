# Contributing to the GDFramework Migration

## Documentation-first workflow

1. Start from the controlled hierarchy in `docs/DOCUMENT_CONTROL.md`.
2. Link behavior changes to functional requirement IDs and acceptance-test IDs.
3. Record legacy defects as `Preserve`, `Fix`, or `Retire`; never silently copy
   or correct behavior.
4. Record architecture/security/compatibility decisions as ADRs.
5. Regenerate traceability and baseline artifacts with
   `tools/Build-ControlledArtifacts.ps1` after controlled-source changes.
6. Run document validation before review.

## Change requirements

- Do not modify the legacy evidence tree to simplify the migration.
- Do not commit secrets, access tokens, passwords, or unredacted connection
  strings.
- Do not introduce machine-specific source/build paths; use
  `LEGACY_SOURCE_ROOT` for legacy evidence.
- Preserve stable requirement, risk, decision, component, dependency, and NFR
  identifiers.
- Update document version/change history when normative behavior, scope,
  architecture, or gate logic changes.
- Tests must exercise observable behavior with real implementations,
  protocol-level fixtures, integration environments, or purpose-built fakes.
  Mockito and substitute mocking frameworks are prohibited.

## Review checklist

- Local Markdown links resolve.
- Tables have consistent columns.
- Controlled IDs are unique.
- Source paths and line references resolve against the captured baseline.
- Requirement/test/evidence status is updated.
- Security, compatibility, operations, and rollback effects are recorded.
- Generated files are regenerated rather than hand-edited.

