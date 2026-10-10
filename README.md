# GDFramework Migration

This repository is the planning and implementation workspace for rebuilding
GDFramework as a modern web platform. The legacy VB6 system is not deployed
anywhere: its source tree and documents are the behavioral reference, and
nothing is migrated, run side by side, or retired.

The rebuild is documentation-first. No replacement implementation may be
treated as conformant until the applicable functional requirements, decisions,
and phase exit criteria have approved evidence.

## Controlled document set

The controlled set is exactly four documents under `docs/`, in precedence order:

1. [Functional specification](docs/GDFramework%20Functional%20Specification.md)
   is normative for observable behavior, compatibility, and functional scope.
   It also holds the non-functional requirements (section 44) and the legacy
   defect disposition register (section 31).
2. [Modern web system design](docs/GDF_MODERN_WEB_SYSTEM_DESIGN.md) is normative for
   the target web architecture, design-verification requirements, and
   implementation boundaries.
3. [Rebuild master plan and design](docs/GDF_MIGRATION_MASTER.md) is normative for
   governance, sequencing, decisions, risks, and quality gates. It also holds
   the reference baseline and evidence boundary (sections 23–24), the
   component, dependency, public API, dataset, and provider inventories
   (sections 25–29), and the architecture decision records (section 30). It
   may not silently override a functional requirement.
4. [Document control](docs/GDF_DOCUMENT_CONTROL.md) defines approval, versioning,
   precedence, and change history, and carries the generated requirement
   traceability matrix (section 8).

Superseded drafts are not kept in the working tree; git history is the archive
(the 0.1 design and plan drafts were last present at commit `bb1991a`).

## Reference implementations of the layouts

- [Open the single-file GDFramework runtime mockup](prototype/gdframework-web-mockup.html).
  It demonstrates the end-user shell, navigation with personal shortcuts,
  tabs, addressable routes, Detach and Reattach, all seven screen families,
  the generic controls and field types, CRUD with conflict and
  unknown-outcome states, filtering with saved filters, lookup, master-detail,
  actions, tree/detail, junction editing, charts, the six message types,
  personalization, export jobs, the print document, About and support
  diagnostics, responsive layout, and light/dark themes.
- [Open the single-file GD Studio administration mockup](prototype/gdframework-admin-mockup.html).
  It demonstrates metadata-driven application, navigation, screen, field,
  command, DataClass, connection and provider-catalogue, value-list, report,
  application-role and application-user (each owned by, and published
  with, its application), validation, impact-analysis, version-comparison,
  approval,
  publication, rollback, retirement, and audit configuration workflows, plus
  the separate Studio roles and Studio users that govern the tool itself.

Both prototypes run locally without a server or external assets and embed their
metadata and representative data sources as JSON. They are the reference
implementations of the target layouts and of the authoring workflow, and the
sample application inside the runtime mockup (Operations Hub and Risk &
Controls) is the first application the rebuilt platform will carry. They are
non-normative for behavior: where they and the design differ, the design
governs (migration master section 3.5).

## Source system

Set `LEGACY_SOURCE_ROOT` to the root of the read-only legacy GDFramework source.
The reviewed snapshot is identified by the checksum baseline under `baseline/`
and described in the migration master, section 23. The tools embed no share or
machine path; when the root is unreachable, the generator reuses the committed
baseline and the validator reports source-path checks as skipped.

The legacy source is the behavioral reference. It is never built, run, or
modified.

## Tools

```powershell
pwsh tools/Build-ControlledArtifacts.ps1   # regenerate baseline (if reachable) and the traceability matrix
pwsh tools/Test-Documentation.ps1          # validate the four-document set
node tools/Test-Mockups.cjs                # contract regressions for both prototypes, and that they agree
```

## Current status

- Functional specification: Controlled working baseline 0.12; framework and
  metadata-schema scope reconstructed from source; applications are authored
- Modern web system design: Controlled working baseline 0.10; complete,
  technology-neutral logical design
- Migration master: Controlled working baseline 0.13
- Document control: Controlled working baseline 0.10
- Phase 0: Started; source control and initial baseline artifacts established
- Replacement code: Not started
- Behavior decisions: all 38 legacy defect dispositions, the desktop-to-web
  reinterpretations (D-017), and specialist scope (D-020, out of scope) are
  approved; see the ADRs in the migration master section 30
- Target UI: Modern web application selected (D-001); framework left open
- Sign-in: OpenID Connect with a server-side session (D-005)
- Data stores: engine-agnostic and configurable (D-013, D-004); first
  qualified engines selected at Gate C
- Stack, transport, and deployment topology: not decided, by design (D-001,
  D-002, D-003, D-007, D-008, D-014)
- Legacy system: not deployed anywhere; no migration, coexistence, or retirement work
