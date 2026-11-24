# annper

This repository is the planning and implementation workspace for annper,
a modern web platform based on the legacy GDFramework. The legacy VB6 system
is not deployed anywhere: its source tree and documents are the behavioral
reference, and nothing is migrated, run side by side, or retired.

The end-user interface is annper Workspace; the metadata administration tool
is annper Studio. Historical source names and legacy command identifiers are
retained where they identify reference evidence or compatibility contracts.

The rebuild is documentation-first. No replacement implementation may be
treated as conformant until the applicable functional requirements, decisions,
and phase exit criteria have approved evidence.

## Controlled document set

The controlled set is five documents under `docs/`, in precedence order:

1. [Functional specification](docs/annper-functional-specification.md)
   is normative for observable behavior, compatibility, and functional scope.
   It also holds the non-functional requirements (section 44) and the legacy
   defect disposition register (section 31).
2. [Modern web system design](docs/annper-modern-web-system-design.md) is normative for
   the target web architecture, design-verification requirements, and
   implementation boundaries.
3. [Rebuild delivery and governance plan](docs/annper-migration-master.md) is
   normative for current status, sequencing, decisions, risks, quality gates,
   and the compact reference baseline. It links to authoritative functional and
   design detail instead of repeating it.
4. [Architecture decision records](docs/annper-architecture-decisions.md) preserve
   approved rationale, consequences, validation, and approvals. The master
   remains the live decision-status register.
5. [Document control](docs/annper-document-control.md) defines approval, versioning,
   precedence, and current baseline history.

The generated [requirements traceability matrix](docs/annper-requirements-traceability.md)
is a derived controlled artifact, not another source of policy.

Superseded drafts are not kept in the working tree; git history is the archive
(the 0.1 design and plan drafts were last present at commit `bb1991a`).

## Reference implementations of the layouts

- [Open the single-file annper Workspace runtime mockup](prototype/annper-web-mockup.html).
  It demonstrates the end-user shell, navigation with personal shortcuts,
  tabs, addressable routes, Detach and Reattach, all seven screen families,
  the generic controls and field types, CRUD with conflict and
  unknown-outcome states, filtering with saved filters, lookup, master-detail,
  actions, tree/detail, junction editing, charts, the six message types,
  personalization, export jobs, the print document, About and support
  diagnostics, responsive layout, and light/dark themes.
- [Open the single-file annper Studio administration mockup](prototype/annper-admin-mockup.html).
  It demonstrates metadata-driven application, navigation, screen, field,
  command, DataClass, connection and provider-catalogue, value-list, report,
  application-role and application-user (each owned by, and published
  with, its application), validation, impact-analysis, version-comparison,
  approval,
  publication, rollback, retirement, and audit configuration workflows, plus
  the separate Studio roles and Studio users that govern the tool itself.

Both prototypes run locally without a server or external assets and embed their
metadata and representative data sources as JSON. They are the reference
implementations of the target layouts and of the authoring workflow. The
sample application inside the runtime mockup (Operations Hub and Risk &
Controls) is the proposed first application, pending Gate B confirmation. They are
non-normative for behavior: where they and the design differ, the design
governs (migration master section 2.3).

## Guides

Working guides restate part of the controlled set for the people who use it.
They are not controlled documents; where a guide and a controlled document
differ, the controlled document governs.

- [Deployment guide](docs/annper-deployment-guide.md): how an application
  configuration, with its application roles and application users, is
  published from annper Studio to annper Workspace, for the first time and afterwards.

## Source system

Set `LEGACY_SOURCE_ROOT` to the root of the read-only legacy GDFramework source.
The reviewed snapshot is identified by the checksum baseline under `baseline/`
and described in the migration master, section 9. The tools embed no share or
machine path; when the root is unreachable, the generator reuses the committed
baseline and the validator reports source-path checks as skipped.

The legacy source is the behavioral reference. It is never built, run, or
modified.

## Tools

```powershell
pwsh tools/Build-ControlledArtifacts.ps1   # regenerate baseline (if reachable) and the traceability matrix
pwsh tools/Test-Documentation.ps1          # validate the controlled document set
node tools/Test-Mockups.cjs                # contract regressions for both prototypes, and that they agree
```

## Current status

- Functional specification: Controlled working baseline 0.13; framework and
  metadata-schema scope reconstructed from source; applications are authored
- Modern web system design: Controlled working baseline 0.12; complete,
  technology-neutral logical design
- Migration master: Controlled working baseline 0.15
- Architecture decision records: Controlled working baseline 0.1
- Document control: Controlled working baseline 0.12
- Phase 0: Started; source control and initial baseline artifacts established
- Replacement code: Not started
- Behavior decisions: all 38 legacy defect dispositions, the desktop-to-web
  reinterpretations (D-017), and specialist scope (D-020, out of scope) are
  approved; see `docs/annper-architecture-decisions.md`
- Target UI: Modern web application selected (D-001); framework left open
- Sign-in: OpenID Connect with a server-side session (D-005)
- Data stores: engine-agnostic and configurable (D-013, D-004); first
  qualified engines selected at Gate C
- Stack, transport, and deployment topology: not decided, by design (D-001,
  D-002, D-003, D-007, D-008, D-014)
- Legacy system: not deployed anywhere; no migration, coexistence, or retirement work
