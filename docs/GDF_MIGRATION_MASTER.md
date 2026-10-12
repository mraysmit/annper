# GDFramework Rebuild Delivery and Governance Plan

**Status:** Controlled working baseline 0.15
**Version:** 0.15
**Date:** 12 October 2026
**Owner:** Migration technical lead
**Legacy checksum-manifest SHA-256:** `fc29779b9588a41cb9da10c486f1f0b35ca2108baf50fb8892086587ee320027`
**Functional authority:** [GD Framework Functional Specification 0.13](GDFramework%20Functional%20Specification.md)
**Design authority:** [GDFramework Modern Web System Design 0.12](GDF_MODERN_WEB_SYSTEM_DESIGN.md)
**Decision records:** [GDFramework Architecture Decision Records 0.1](GDF_ARCHITECTURE_DECISIONS.md)
**Document control:** [GDF_DOCUMENT_CONTROL.md](GDF_DOCUMENT_CONTROL.md)

## 1. Purpose, authority, and current position

This document governs delivery of the GDFramework rebuild: sequencing,
ownership, decisions, risks, and quality gates. It does not restate the
functional specification or target design. Where a summary here differs from
either higher-precedence document, those documents govern.

The legacy VB6 system is not deployed. No production instance, populated
metadata store, application database, user population, helper binary, or
dependent consumer exists. The checksummed source snapshot is a behavioral
reference, not a system to migrate. There is therefore no coexistence,
side-by-side routing, cutover, or legacy-retirement work.

An intentional behavioral difference requires an approved defect disposition
or product decision. An architecture or compatibility decision requires an ADR
linked from section 7 and governed by
[GDF_ARCHITECTURE_DECISIONS.md](GDF_ARCHITECTURE_DECISIONS.md).

### 1.1 Current position

| Area | Position at 12 October 2026 |
|---|---|
| Delivery phase | Phase 0 is active; Gate A has not passed because D-009 is open |
| Replacement code | Not started; scaffolding waits for Gate C |
| Behavior | D-011, D-017, and D-020 are approved; unresolved `RUNTIME-VERIFY`, `DOCUMENT CONFLICT`, and D-021 scope rows still block Gate B |
| First application | The prototype reference application is proposed; Gate B confirmation and completed authored catalogue remain outstanding |
| Authentication | D-005 approved: OpenID Connect with a server-side session |
| Data stores | D-004 and D-013 establish provider neutrality; the first provider and store engine remain Gate C selections |
| Technology | Browser framework, runtime, transport, and topology remain open under D-001, D-002, D-003, D-007, and D-008 |
| Next gate | Gate A: approve the canonical reference source per component under D-009 |

### 1.2 Evidence boundary

The reviewed source and reconstructed metadata schema are the available legacy
evidence. The source will not be built or run, and no deployment evidence will
be obtained. Gaps are resolved as follows:

| Missing evidence | Resolution |
|---|---|
| Populated metadata, applications, roles, and users | Author them in the rebuilt platform under D-015 |
| Physical metadata DDL and application databases | Design them under D-013 and D-010 |
| Runtime-only behavior or conflicting documents | Record a product decision and test the decided behavior |
| Deployed binaries and divergent source lineage | Select the reference copy on technical merit under D-009 |
| Production scale and service characteristics | Use the provisional NFR profiles until a recorded decision changes them |
| Business reliance on quirks | Apply D-011; Fix or Retire is the default, and Preserve requires a recorded reason |

## 2. Direction and scope

### 2.1 Outcomes

The rebuild shall:

- preserve approved workflows and data semantics through explicit, versioned
  contracts rather than COM or ADO compatibility;
- establish trusted authentication and authorize every protected operation;
- use typed parameters, provider adapters, and explicit transaction policies;
- report validation, conflict, provider failure, timeout, and unknown mutation
  outcomes truthfully;
- retain metadata-driven application definition and governed authoring;
- provide structured diagnostics, audit, health, recovery, and rollback; and
- build and test from a clean, reproducible environment.

The first release does not build or run the VB6 source, expose a compatibility
layer, reproduce known defects without approval, or implement dormant and
historical features without an explicit decision.

### 2.2 Delivery strategy

Delivery proceeds in six evidence-gated increments:

1. establish the reference baseline;
2. decide behavior and define the first application;
3. approve the architecture and create the foundation;
4. prove one end-to-end vertical slice;
5. complete the in-scope platform capabilities; and
6. release and operate the platform and first application.

### 2.3 Reference layouts and first application

The dependency-free prototypes under `prototype/` are visual references, not
production code:

| Prototype | Purpose |
|---|---|
| `gdframework-web-mockup.html` | Runtime shell, all seven screen families, user workflows, messages, export, print, diagnostics, responsive layout, and failure states |
| `gdframework-admin-mockup.html` | Application authoring, validation, approval, publication, rollback, security administration, and audit workflows |

The runtime prototype's Operations Hub and Risk & Controls application is the
proposed first application. Gate B confirms it and its initial Order register
and Customer records slice. The design governs wherever a prototype differs
from the controlled documents.

## 3. Governance and engineering controls

### 3.1 Ownership

One person may hold several roles, but every responsibility must remain named.
The current assignees are recorded in document control section 7.

| Role | Accountability |
|---|---|
| Product/domain owner | Behavior, scope, defect disposition, and workflow acceptance |
| Legacy technical owner | Reference-source interpretation and lineage |
| Migration technical lead | Architecture, sequencing, dependency rules, and gates |
| Database owner | Provider constraints, fixtures, and reconciliation evidence |
| Security owner | Identity, authorization, secrets, audit, and threat model |
| Operations owner | Environments, deployment, monitoring, recovery, and support |
| Test/quality owner | Characterization, integration, conformance, and exit evidence |
| UI/workflow owner | Accessibility, workflow, integration constraints, and client acceptance |

### 3.2 Change control

- A phase begins only when its entry gate has passed.
- Contract, security, provider, scope, or UI-direction changes require a
  recorded decision.
- Open decisions are not implementation defaults.
- No exception may expose raw SQL, live database objects, credentials, or
  unverified identity.
- An approved ADR cannot silently override a functional requirement.
- Superseded detail remains available through git history; the live documents
  carry only current rules and compact tombstones needed for stable IDs.

### 3.3 Definition of done

A delivery item is complete only when its behavior and failures are specified,
its implementation respects the approved boundaries, its observable behavior
is tested, security and operational concerns are verified, documentation and
traceability are current, and the applicable gate evidence is recorded.

### 3.4 Verification policy

Tests use real implementations, protocol-level fixtures, disposable
integration environments, or small purpose-built fakes. Mockito and all other
mocking frameworks used to substitute generated doubles for real boundaries
are prohibited. External adapters must exercise actual serialization,
transport, response parsing, failure behavior, transactions, and cleanup.

The test portfolio comprises characterization, contract, provider integration,
conformance, UI behavior, security, operational, accessibility, and performance
tests. Quantitative targets are controlled by functional specification section
44. Golden-file normalization may remove nondeterministic values but must not
hide material behavioral differences.

## 4. Delivery roadmap

Calendar commitments are made only after Gate B, when application scope,
providers, environments, and team allocation are known. Progress is measured
by gate evidence rather than percentage-complete estimates.

| Phase | Objective | Principal outputs | Exit |
|---:|---|---|---|
| 0 | Establish the reference baseline | Checksummed snapshot, component/dependency references, canonical-source ADR, named owners | Gate A |
| 1 | Decide behavior and first-application scope | Resolved defects and ambiguities, confirmed reference application, authored catalogue, characterization fixtures | Gate B |
| 2 | Approve architecture and create foundation | Technology ADRs, buildable skeleton, contract v1, CI, integration environment | Gate C |
| 3 | Prove the vertical slice | Published metadata, authenticated browser workflow, first provider/store adapters, secure query/change path, recovery evidence | Gate D |
| 4 | Complete platform capabilities | Remaining screen families, authoring, security, jobs, reports, selected providers, second store engine | Gate E |
| 5 | Release and operate | Production deployment, penetration test, accessibility evidence, restore exercise, runbooks, monitoring, support handover | Gate F |

Phase 3 covers the Order register and Customer records screens, the minimum
authoring path needed to publish them, OpenID Connect sign-in, the first
qualified application provider and platform-store adapter, default DataClass
caching, durable mutation status, and crash-recoverable post-commit effects.

Phase 4 expands in this order: core reads and formats; mutations; complete
authoring and publication; security and personalization; remaining screen
families; procedures and actions; reports/export/print/jobs; optional XML or
extension adapters; and further qualified providers. Aggregation, limit
processing, and PLM remain out of scope under D-020.

Phase 5 requires D-024 before the first production promotion. Rollback always
means returning the rebuilt platform or an application configuration to its
previous known-good version; no legacy runtime exists to receive traffic.

## 5. Quality gates

This section is the single source of truth for phase exits. Phase descriptions,
status reports, and work tracking link here rather than restating these criteria.

### Gate A — Reference baseline trustworthy

- The section 9 manifest identity is reverified.
- The compact component and dependency references in section 10 are complete.
- D-009 selects the canonical source per component through an approved ADR.
- D-011 remains approved and named owners remain recorded.

### Gate B — Behavior decided

- DEF-001..DEF-038 retain approved dispositions and every desktop-bound row
  retains its D-017 decision.
- Every `RUNTIME-VERIFY` and `DOCUMENT CONFLICT` row is resolved by reading or
  by a recorded product decision.
- D-020 and D-021 scope are recorded.
- The first application's scope, owner, catalogue, acceptance scenarios, and
  slice fixtures are approved.

### Gate C — Architecture approved

- D-001 and D-008 are decided and not deferred; D-005 remains approved.
- The first D-004 application provider and D-013 platform-store engine are
  selected and qualified.
- D-002, D-003, D-007, D-014, D-015's approval model, and D-016 are decided or
  explicitly deferred with a documented safe default.
- If the slice includes dual-source writes, D-021's provider-pair atomicity and
  recovery strategy is approved.
- A clean checkout builds on the pinned image; contracts expose no
  infrastructure types; secrets remain outside source and logs
  (NFR-BUILD-001, NFR-OBS-001, NFR-SEC-003).

### Gate D — Vertical slice proven

- Slice conformance, integration, security, accessibility, recovery, cleanup,
  deployment, and rollback tests pass.
- Writes are atomic and accurately reported at the interactive-change profile
  (NFR-REL-001, NFR-PERF-003).
- Lost replies, duplicates, restart, unknown outcomes, and post-commit crashes
  recover without blind replay (WDES-020, WDES-021).
- Authoring, withdrawal, scoped cache/304, application-access, and Studio-access
  tests pass (WDES-019, WDES-022, WDES-023, WDES-027, WDES-028).
- Impersonation, injection, raw database access, and secret leakage fail safely
  (NFR-SEC-001, NFR-SEC-002, NFR-SEC-003).
- Sign-in, session-cookie, CSRF, and revocation tests pass (WDES-026), and the
  selected store engine passes WDES-025.
- Slice screens pass NFR-ACC-001, and failures are diagnosable without exposing
  sensitive data (NFR-OBS-001, NFR-OBS-002).

### Gate E — Platform capability complete

- Every in-scope scenario FR-ACC-001..FR-ACC-018 passes for the first
  application.
- Every selected provider has real integration and cleanup evidence
  (NFR-REL-002); each admitted dual-source pair passes WDES-024.
- The platform-store suite passes on at least two engines and no platform
  service contains engine-specific SQL (WDES-025).
- The functional specification section 44 profiles pass for NFR-PERF-001,
  NFR-PERF-002, NFR-PERF-003, NFR-PERF-004, and NFR-SCALE-001.
- The first application's authored catalogue is complete.

### Gate F — Release ready

- FR-ACC-019 records NFR-ACC-001, NFR-UI-001, and NFR-I18N-001 across supported
  workflows, NFR-REL-003 restart recovery, NFR-DR-001 restore evidence, and the
  NFR-AVAIL-001 observation period.
- Independent penetration testing has no open critical or high finding.
- Reproducible artifacts, health checks, monitoring, backup, rollback,
  runbooks, on-call ownership, and support handover are in place.
- NFR-COMP-001 remains not applicable because no legacy consumer or adapter
  exists.

## 6. Risk register

### 6.1 Active and controlled risks

| ID | Risk | Status | Owner | Next review | Control or required evidence |
|---|---|---|---|---|---|
| R-001 | Wrong source copy becomes the reference | Active | Legacy technical owner | 2026-10-15 | Compare divergent lineages and approve D-009 |
| R-002 | Source reading misstates behavior | Open | Test/quality owner | 2026-10-15 | Resolve ambiguous rows by decision and test the decided behavior |
| R-004 | Provider behavior diverges from the typed contract | Open | Database owner | 2026-11-10 | Real provider integration tests before qualification |
| R-005 | Unsafe legacy behavior is reproduced | Controlled | Security owner | 2026-11-10 | D-011 permits only approved Fix, Retire, or justified Preserve dispositions |
| R-006 | Late ambiguity changes a delivered workflow | Open | Product/domain owner | 2026-10-15 | Unresolved behavior blocks Gate B |
| R-007 | Authoring accepts unsafe executable definitions | Open | Migration technical lead | 2026-11-10 | Compiler validation plus authoring security tests |
| R-008 | Caches leak data or serve stale results | Open | Migration technical lead | 2026-11-10 | Scoped keys, authorization recheck, durable invalidation, isolation tests |
| R-009 | Framework is selected without accessibility/performance evidence | Controlled | UI/workflow owner | 2026-11-10 | D-001 spike required by Gate C |
| R-011 | Unrealistic test data creates false confidence | Open | Test/quality owner | 2026-11-10 | Versioned synthetic data at section 44 profiles |
| R-012 | Toolchain creates workstation-specific builds | Open | Operations owner | 2026-11-10 | Pin D-008 toolchain, dependencies, and CI image |
| R-014 | Historical features enter scope accidentally | Controlled | Product/domain owner | 2026-11-10 | D-019 and D-020 gate inclusion |
| R-015 | Generic UI behavior is simplified prematurely | Controlled | UI/workflow owner | 2026-11-10 | Map replacements to FR-CMD-* and FR-CTL-* requirements |
| R-016 | Access to the reference source is lost | Open | Legacy technical owner | 2026-10-15 | Maintain the checksum baseline and a controlled archival copy |
| R-019 | Reference knowledge depends on one reader | Open | Migration technical lead | 2026-10-15 | Paired review and written reading notes |
| R-020 | Engine neutrality erodes | Open | Database owner | 2026-11-10 | Adapter boundary tests and two qualified store engines before Gate E |

### 6.2 Closed risk tombstones

| ID | Closed reason |
|---|---|
| R-003 | No deployed consumer exists |
| R-010 | No compatibility layer exists |
| R-013 | No deployed metadata is expected; applications are authored |
| R-017 | No production binaries exist to reconcile |
| R-018 | The legacy runtime is not built, so historical control licensing is irrelevant |

## 7. Decision register

The ADR column links to approved rationale in the separate controlled decision
record. `Open` means implementation must not invent an answer. A documented
safe default permits deferral only where Gate C explicitly allows it.

| ID | Decision | Owner | Required by | Status | ADR |
|---|---|---|---|---|---|
| D-001 | Select the browser framework and design system after the accessibility/performance spike | UI/workflow owner | Gate C | Direction selected; framework open | Pending |
| D-002 | Select the service transport | Migration technical lead | Gate C or safe deferral | Open | Pending |
| D-003 | Select hosting and deployment topology | Operations owner | Gate C or safe deferral | Open | Pending |
| D-004 | Select and qualify application providers; none is privileged | Database owner | First at Gate C; later per Phase 4 group | Direction approved; first provider open | [ADR-005](GDF_ARCHITECTURE_DECISIONS.md#adr-005--engine-agnostic-platform-store-and-configurable-providers) |
| D-005 | Use OpenID Connect with a server-side session; automated-client identity remains open | Security owner | Gate C | Interactive sign-in approved | [ADR-004](GDF_ARCHITECTURE_DECISIONS.md#adr-004--openid-connect-sign-in-with-a-server-side-session) |
| D-006 | Compatibility duration | — | — | Closed: not applicable | — |
| D-007 | Select the dataset wire contract using representative payloads | Migration technical lead | Gate C or safe deferral | Open | Pending |
| D-008 | Select the supported implementation runtime and toolchain | Migration technical lead | Gate C | Open | Pending |
| D-009 | Select canonical reference source per component | Legacy technical owner | Gate A | Open | Pending |
| D-010 | Define each authored application's database schema or connection policy | Database owner | Before application database design | Open per application | Pending |
| D-011 | Fix or Retire legacy defects by default; Preserve requires a reason | Product/domain owner | Gate B entry | Approved | [ADR-001](GDF_ARCHITECTURE_DECISIONS.md#adr-001--legacy-defect-disposition-policy) |
| D-012 | Side-by-side routing unit | — | — | Closed: not applicable | — |
| D-013 | Keep the platform store engine-agnostic and qualify engines through one conformance suite | Migration technical lead | First at Gate C; second by Gate E | Direction approved; first engine open | [ADR-005](GDF_ARCHITECTURE_DECISIONS.md#adr-005--engine-agnostic-platform-store-and-configurable-providers) |
| D-014 | Select queue, distributed cache, and object storage when needed | Operations owner | Before the dependent phase | Open | Pending |
| D-015 | Deliver governed web authoring in the first release and decide its approval model | Product/domain owner | Approval model at Gate C | Authoring adopted; approval model open | Pending |
| D-016 | Confirm online-only behavior or approve a secure offline design | UI/workflow owner | Gate C or safe deferral | Online-only default adopted | Pending if challenged |
| D-017 | Apply the approved web equivalents for desktop-bound behavior and legacy controls | Product/domain and UI/workflow owners | Gate B | Approved | [ADR-002](GDF_ARCHITECTURE_DECISIONS.md#adr-002--desktop-bound-behavior-and-legacy-control-scope) |
| D-018 | Define technology-neutral format tokens | Migration technical lead | Before Phase 4 formatting work | Open | Pending |
| D-019 | Decide which legacy extension contracts survive as registered adapters | Migration technical lead | Before Phase 4 extension work | Open | Pending |
| D-020 | Exclude PLM, aggregation, and limit processing | Product/domain owner | Gate B | Approved | [ADR-003](GDF_ARCHITECTURE_DECISIONS.md#adr-003--plm-aggregation-and-limit-processing-out-of-scope) |
| D-021 | Decide dual-source-write scope and qualify atomicity/recovery per provider pair | Product/domain, database, and migration owners | Scope at Gate B; strategy before use | Open | Pending |
| D-022 | Keep each application's roles and users inside its published configuration | Product/domain and security owners | Gate C | Approved; ADR-006 superseded | [ADR-008](GDF_ARCHITECTURE_DECISIONS.md#adr-008--roles-and-users-belong-to-each-application-configuration) |
| D-023 | Manage fixed Studio roles inside the authoring tool with second-person approval | Security and operations owners | Gate C | Approved | [ADR-007](GDF_ARCHITECTURE_DECISIONS.md#adr-007--administrative-roles-granted-in-the-authoring-tool) |
| D-024 | Decide promotion between environments and environment scope of application users | Operations, product, and security owners | Before production promotion | Open | Pending |

## 8. Immediate actions and blockers

Work proceeds in this order:

1. Resolve D-009 and pass Gate A.
2. Resolve remaining `RUNTIME-VERIFY` and `DOCUMENT CONFLICT` rows.
3. Confirm the reference application, its owner, and its two-screen slice.
4. Decide D-021 scope and D-019 extension scope.
5. Complete the first application's catalogue and characterization fixtures;
   then pass Gate B.
6. Run the D-001 spike and decide D-001, D-008, the first D-004 provider, and
   the first D-013 store engine.
7. Resolve or safely defer the remaining Gate C decisions before scaffolding.

## 9. Reference baseline

**Status:** Controlled repository snapshot captured 6 September 2026; no
deployed instance exists for comparison.

### 9.1 Evidence root

| Token/scope | Reviewed location | Portable use |
|---|---|---|
| `${LEGACY_SOURCE_ROOT}` | `\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework` | Configure externally; never embed this path in build logic |
| GUI sibling | `${LEGACY_SOURCE_ROOT}/../GenData/AppGUI` | Included because the shell and generic UI sit outside the core root |

### 9.2 Generated evidence

| Artifact | Purpose |
|---|---|
| `../baseline/legacy-file-inventory.csv` | Path, size, timestamp, extension, and SHA-256 for every captured file |
| `../baseline/legacy-source.sha256` | Portable checksum list |
| `../baseline/legacy-source-manifest.sha256` | Identity of the checksum list |

The current manifest identity is
`fc29779b9588a41cb9da10c486f1f0b35ca2108baf50fb8892086587ee320027`.
Regenerate it only through `tools/Build-ControlledArtifacts.ps1`. A changed
identity requires review of affected requirements and a new controlled version.

The snapshot contains 123 VB source files and 55,504 physical lines in the core
tree, or 160 files and 79,100 lines with the sibling GUI tree. These are
inventory measures, not claims about compiled membership. Divergent source
copies, retained binaries, machine state, and runtime-only behavior remain
accepted limitations resolved through D-009 or product decisions.

## 10. Reference catalog pointers

The detailed behavioral and design contracts live in the functional
specification and modern system design. This section retains stable inventory
identifiers and qualification status without duplicating those contracts.

### 10.1 Components

| ID | Reference component | Disposition |
|---|---|---|
| CMP-001 | Standard GUI project | Primary shell and generic-UI reference |
| CMP-002 | Older GUI build project | Lineage only |
| CMP-003 | Standard client project | Primary client reference |
| CMP-004 | Older client build project | Lineage only |
| CMP-005 | Nested duplicate client project | No reference role |
| CMP-006 | Nested duplicate client build project | No reference role |
| CMP-007 | Standard server project | Primary server candidate, subject to D-009 |
| CMP-008 | Shared alternate server project | D-009 comparison evidence |
| CMP-009 | Aggregator project | Out of scope under D-020 |
| CMP-010 | Duplicate aggregator project | Lineage only |
| CMP-011 | Custom control project | Modern component behavior reference |
| CMP-012 | Control smoke host | Development evidence only |
| CMP-013 | Shared interfaces project | D-019 extension-contract reference |
| CMP-014 | Older marker/interface project | Lineage only |
| CMP-015 | Helper validation harness | Incomplete example, not an oracle |
| CMP-016 | RDS/simple-service harness | Out of scope unless D-019 admits it |

Normative project responsibilities and lineage are in functional specification
sections 37, 40, and 42.

### 10.2 Dependencies

| ID | Legacy dependency | Treatment |
|---|---|---|
| DEP-001 | VB6 runtime/OLE Automation | Replace |
| DEP-002 | ADO 2.5 | Replace with versioned tabular contracts |
| DEP-003 | CDO/MAPI | Supported notification service if required |
| DEP-004 | Excel Automation | Server-generated files without Office |
| DEP-005 | Scripting Runtime | Platform file/configuration APIs |
| DEP-006 | `SecureLogPass` | Secret store; legacy contract not recoverable |
| DEP-007 | Internal COM binaries | Explicit modules or services |
| DEP-008 | GridEX | Modern grid behavior replacement |
| DEP-009 | Microsoft Forms | Replace |
| DEP-010 | Common Controls OCXs | Native modern controls |
| DEP-011 | Rich Text control | Supported safe markup |
| DEP-012 | Common Dialog control | Native supported dialogs |
| DEP-013 | MSChart | Modern chart engine |
| DEP-014 | Calendar control | Supported date picker |
| DEP-015 | JSBBar | Navigation behavior replacement |
| DEP-016 | Sheridan 3D control | No direct modern dependency |
| DEP-017 | MSDE runtime | Not migrated |
| DEP-018 | External RDS server | Excluded unless D-019 admits it |

Normative dependency evidence is in functional specification sections 38 and
42. No legacy dependency is installed or deployed by this rebuild.

### 10.3 API, metadata, and providers

- The legacy public API is behavioral reference only; no COM identifier or
  binary contract is preserved. Functional specification sections 24, 26, 37,
  40, and 42 contain the authoritative detail.
- The metadata grammar is functional specification section 28. Each authored
  application must completely define applications, navigation, screens,
  fields, commands, DataClasses, connections, values, reports, roles, users,
  messages, and database objects before it is complete.
- Legacy provider paths—Sybase, SQL Server, Oracle, Access, XML, and the simple
  service helper—are lineage, not a support promise. A provider becomes
  supported only after D-004 selects it and real integration tests prove typed
  binding, null/date/decimal/binary fidelity, ordering, transactions,
  concurrency, cancellation, timeout, recovery, safe diagnostics, and cleanup.
- No platform-store engine is qualified yet. The first is selected at Gate C;
  at least two must pass the common store conformance suite before Gate E.

## 11. Architecture decision record index

Full decision context, consequences, validation, and approvals are maintained
in [GDF_ARCHITECTURE_DECISIONS.md](GDF_ARCHITECTURE_DECISIONS.md). The live
decision status and delivery deadline remain canonical in section 7.

| Record | Decision | Status |
|---|---|---|
| ADR-001 | D-011 legacy defect disposition policy | Approved |
| ADR-002 | D-017 desktop-bound behavior and legacy control scope | Approved |
| ADR-003 | D-020 specialist component scope | Approved |
| ADR-004 | D-005 authentication and session | Approved |
| ADR-005 | D-004/D-013 provider and store neutrality | Approved |
| ADR-006 | Earlier D-022 live-administration model | Superseded by ADR-008 |
| ADR-007 | D-023 Studio access | Approved |
| ADR-008 | D-022 application-owned roles and users | Approved |
