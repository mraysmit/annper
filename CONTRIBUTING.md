# Contributing to the GDFramework Rebuild

## Documentation-first workflow

1. Start from the controlled hierarchy in `docs/GDF_DOCUMENT_CONTROL.md`. The
   controlled set is the five documents named there. Working guides may
   summarize them but are non-normative.
2. Link behavior changes to functional requirement IDs (`FR-*`, `NFR-*`) and
   acceptance-test IDs (`AT-<ID>`).
3. Record legacy defect decisions as `Preserve`, `Fix`, or `Retire` in the
   `Decision`, `Approvers`, and `Approval date` columns of the functional
   specification section 31; never silently copy or correct behavior.
   Desktop-bound behaviors that cannot be carried into the browser go in
   section 32.1 under decision D-017.
4. Record architecture/security/compatibility decisions in
   `GDF_ARCHITECTURE_DECISIONS.md` and link them from the migration master
   section 7 register.
5. Regenerate `docs/GDF_REQUIREMENTS_TRACEABILITY.md` with
   `tools/Build-ControlledArtifacts.ps1` after any change to `FR-*`, `NFR-*`,
   `DEF-*`, or `WDES-*` rows. Regenerate the checksum baseline only with
   `LEGACY_SOURCE_ROOT` set to the reviewed legacy tree.
6. Run `tools/Test-Documentation.ps1` before review.

## Change requirements

- Do not modify, build, or run the legacy reference tree.
- Do not commit secrets, access tokens, passwords, or unredacted connection
  strings.
- Do not introduce machine-specific or share-specific paths in documents or
  build logic; use `LEGACY_SOURCE_ROOT` for legacy evidence. The single
  exception is the reviewed-location record in `GDF_MIGRATION_MASTER.md`
  section 9.1, which is evidence about the reviewed copy and is the only
  line the validator exempts.
- Preserve stable requirement, risk, decision, evidence, component, dependency,
  NFR, and design-verification identifiers.
- Update the current change history in `docs/GDF_DOCUMENT_CONTROL.md`
  section 6 and the document's own header when normative behavior, scope,
  architecture, or gate logic changes.
- Tests must exercise observable behavior with real implementations,
  protocol-level fixtures, integration environments, or purpose-built fakes at
  protocol boundaries. Mocking frameworks are prohibited.

## Review checklist

- `tools/Test-Documentation.ps1` passes (tables, links and anchors, ID
  uniqueness, traceability coverage, NFR/decision linkage, manifest
  identity, no machine paths).
- Source paths and line references resolve against the captured baseline when
  the legacy tree is reachable.
- Requirement/test/evidence status is updated.
- Security, compatibility, operations, and rollback effects are recorded.
- Generated rows are regenerated rather than hand-edited.
