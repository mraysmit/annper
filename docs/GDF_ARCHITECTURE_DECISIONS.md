# GDFramework Architecture Decision Records

**Version:** 0.1\
**Date:** 2026-10-12\
**Author:** Mark Ray-Smith — Cityline Ltd\
**Status:** Controlled working baseline\
**Scope:** Architecture, security, and compatibility decisions

## 1. Authority and record format

This document contains the durable rationale and approval evidence for
architecture, security, and compatibility decisions. [Migration master
section 7](GDF_MIGRATION_MASTER.md#7-decision-register) owns live status,
delivery timing, and open decisions. An ADR cannot silently override the
functional specification or modern system design. Document versions and
approvals are governed by [document control](GDF_DOCUMENT_CONTROL.md).

A new record must state its status, date, owner, decision-register ID, affected
requirements, context, decision, consequences, validation or reversal path,
and named approvals. Superseded decisions remain as compact tombstones when a
later ADR contains the governing rationale.

## 2. Record index

| Record | Decision | Status | Date |
|---|---|---|---|
| [ADR-001](#adr-001--legacy-defect-disposition-policy) | D-011 legacy defect disposition policy | Approved | 2026-10-10 |
| [ADR-002](#adr-002--desktop-bound-behavior-and-legacy-control-scope) | D-017 desktop-bound behavior and legacy control scope | Approved | 2026-10-10 |
| [ADR-003](#adr-003--plm-aggregation-and-limit-processing-out-of-scope) | D-020 specialist component scope | Approved | 2026-10-10 |
| [ADR-004](#adr-004--openid-connect-sign-in-with-a-server-side-session) | D-005 authentication and session | Approved | 2026-10-10 |
| [ADR-005](#adr-005--engine-agnostic-platform-store-and-configurable-providers) | D-004 and D-013 provider and store neutrality | Approved | 2026-10-10 |
| [ADR-006](#adr-006--live-user-administration-outside-publication) | Earlier D-022 user-administration model | Superseded by ADR-008 | 2026-10-10 |
| [ADR-007](#adr-007--administrative-roles-granted-in-the-authoring-tool) | D-023 Studio access | Approved | 2026-10-10 |
| [ADR-008](#adr-008--roles-and-users-belong-to-each-application-configuration) | Revised D-022 application-access model | Approved | 2026-10-10 |

## ADR-001 — Legacy defect disposition policy

**Status:** Approved
**Owner:** Product/domain owner, Mark Raysmith
**Decision register ID:** D-011
**Affected requirements:** DEF-001..DEF-038; FR-INV-008, FR-INV-009;
NFR-SEC-001, NFR-SEC-003, NFR-REL-001

### Context

The source contains 38 recorded defects, but no deployed user or consumer
depends on them. Preserving defects by default would reproduce unsafe or
incorrect behavior without a compatibility benefit.

### Decision

`Fix` or `Retire` is the default. `Preserve` requires a recorded product reason.
The Product/domain owner approves each disposition with the security owner and
affected technical owner. Applied on 10 October 2026, DEF-011, DEF-023,
DEF-025, DEF-027, DEF-028, and DEF-034 are Retire; the other 32 are Fix.

### Consequences and validation

Every Fix is an intentional difference requiring an acceptance test.
AT-DEF-001..AT-DEF-038 in
[GDF_REQUIREMENTS_TRACEABILITY.md](GDF_REQUIREMENTS_TRACEABILITY.md) provide the mapping. A
later disposition change requires a new decision, specification version, and
regenerated traceability.

**Approved by:** Mark Raysmith as Product/domain owner, Security owner, and
Migration technical lead on 2026-10-10.

## ADR-002 — Desktop-bound behavior and legacy control scope

**Status:** Approved
**Owner:** Product/domain owner with UI/workflow owner, Mark Raysmith
**Decision register ID:** D-017
**Affected requirements:** Functional specification section 32.1;
FR-NAV-008, FR-CTL-LU-006, FR-CTL-API-005, FR-CTL-USE-005..007,
FR-INV-012, FR-ACC-004; NFR-UI-001, NFR-ACC-001, NFR-SEC-001

### Context

Several verified behaviors depend on workstation identity, local files,
installed Office, operating-system windows, or fixed coordinates. A browser
cannot reproduce them literally without excluded plug-ins or local agents.

### Decision

Approve the design section 7.7 web equivalents:

| Area | Approved equivalent |
|---|---|
| Identity | Identity-provider subject; workstation identity is never authority |
| Shell layout | Browser-owned window geometry; application preferences retain relevant layout state |
| Element coordinates | Responsive order and grouping; authored coordinates are ignored |
| Detach/Reattach | Separate window or route sharing the authenticated session |
| Diagnostics | Server telemetry plus About and authorized support views |
| Print | Print view or download without preserving window bounds |
| Export | Server-generated files; Export All produces one multi-sheet job output |
| Messages | Subject, role, application, group, or system audiences |

Do not preserve standard-Windows-menu mode, arbitrary-depth navigation,
distinct contracts for the retired legacy lookup/Outlook controls and tooltip
helper, or design-time setter guards.

### Consequences and validation

The approved equivalents, not the literal desktop behavior, are the acceptance
baseline. Validate through the affected FR rows, FR-ACC-004, NFR-UI-001, and
NFR-ACC-001. A change requires a new decision and controlled document versions.

**Approved by:** Mark Raysmith as Product/domain owner and UI/workflow owner on
2026-10-10.

## ADR-003 — PLM, aggregation, and limit processing out of scope

**Status:** Approved
**Owner:** Product/domain owner, Mark Raysmith
**Decision register ID:** D-020
**Affected requirements:** FR-AGG-*, FR-LIMIT-*, FR-PLM-*; WDES-009

### Context

The Aggregator exists in source, the Limit Server is source-only, and most PLM
capabilities are documentation-only. No authored application needs them.

### Decision

PLM, aggregation, and limit processing are out of scope for the rebuild. The
reference application's Run limit check remains an ordinary Action DataClass.

### Consequences and validation

No acceptance test is implemented for the excluded rows. Reopening scope
requires a new decision and authored contracts, metadata, and acceptance cases.

**Approved by:** Mark Raysmith as Product/domain owner on 2026-10-10.

## ADR-004 — OpenID Connect sign-in with a server-side session

**Status:** Approved
**Owner:** Security owner, Mark Raysmith
**Decision register ID:** D-005
**Affected requirements:** FR-SEC-001..003, FR-SEC-009, FR-SHUT-002,
FR-START-009; NFR-SEC-001..003; WDES-003, WDES-017, WDES-026

### Context

The legacy system trusted workstation and caller-supplied identity. The web
platform requires identity established at a trusted boundary without exposing
provider tokens to browser script.

### Decision

Interactive users authenticate through OpenID Connect authorization code flow
with PKCE. The host retains provider tokens and server-side session state. The
browser receives only a regenerated opaque identifier in an HttpOnly, Secure,
SameSite cookie scoped to the application origin. The identity-provider product
is deployment configuration. Automated-client identity remains a separate
decision before the first automated contract is published.

### Consequences and validation

State-changing requests require CSRF protection. Session state must work
without instance affinity, and the client/API edge presents one origin. Validate
WDES-026 and NFR-SEC-001..002 at Gate D and complete independent penetration
testing at Gate F.

**Approved by:** Mark Raysmith as Security owner and Migration technical lead
on 2026-10-10.

## ADR-005 — Engine-agnostic platform store and configurable providers

**Status:** Approved
**Owner:** Migration technical lead with Database owner, Mark Raysmith
**Decision register IDs:** D-004 and D-013
**Affected requirements:** FR-ARCH-001, FR-CONN-*, FR-META-003, FR-INV-004;
NFR-REL-001, NFR-REL-002, NFR-DR-001, NFR-BUILD-001; WDES-011, WDES-025

### Context

No database, licence, hosting constraint, or authored application selects an
engine. A generic-SQL abstraction would still leak differences in locking,
paging, types, and errors.

### Decision

The platform store is accessed only through a store adapter and may use any
engine that passes the common store conformance suite. Application providers
are registered adapters enabled only after their integration matrix passes. No
engine is privileged. Gate C selects the first store engine and application
provider; they may be the same.

### Consequences and validation

Platform services contain no engine-specific SQL or driver types. Migrations
are tested for every qualified store engine. At least two store engines must
pass before Gate E. Each additional qualified engine increases integration and
recovery-test cost.

**Approved by:** Mark Raysmith as Migration technical lead and Database owner
on 2026-10-10.

## ADR-006 — Live user administration outside publication

**Status:** Superseded by ADR-008 on 2026-10-10
**Decision register ID:** D-022

This record originally placed application users in live platform-wide
administration outside publication. The owner rejected that model later the
same day. ADR-008 contains the governing rationale and consequences; this
tombstone remains only to preserve record identity.

## ADR-007 — Administrative roles granted in the authoring tool

**Status:** Approved
**Owner:** Security owner with Operations owner, Mark Raysmith
**Decision register ID:** D-023
**Affected requirements:** FR-INV-002; NFR-SEC-001, NFR-SEC-002;
WDES-003, WDES-019, WDES-027, WDES-028

### Context

The design names the people who operate the platform but needs a governed way
to appoint them without allowing self-granting or relying on application roles.

### Decision

Studio roles are a fixed platform set administered inside the authoring tool as
live data. Grants require approval from a second platform administrator;
revocation is immediate; nobody may change their own roles; deployment
configuration names at least two bootstrap platform administrators. Studio
access and application access grant nothing to one another.

### Consequences and validation

The authoring tool provides a Studio-user administration surface and complete
audit. Validate WDES-028 and the NFR-SEC-002 role matrix at Gate D, including
self-change refusal, unapproved grants, and the two-administrator floor.

**Approved by:** Mark Raysmith as Security owner and Operations owner on
2026-10-10.

## ADR-008 — Roles and users belong to each application configuration

**Status:** Approved; supersedes ADR-006
**Owner:** Product/domain owner with Security owner, Mark Raysmith
**Decision register ID:** D-022
**Affected requirements:** FR-SEC-002..006, FR-SEC-008, FR-SEC-009,
FR-INV-001, FR-INV-002; NFR-SEC-002; WDES-007, WDES-023, WDES-027

### Context

The owner rejected ADR-006's platform-wide live user list. The reference schema
scoped roles, memberships, and application assignments by application, and the
desired product model treats one application configuration as a self-contained
publishable unit.

### Decision

Each application owns its roles and users. They are edited in that application's
draft and become effective only when it is validated, approved, and published.
Nothing is shared across applications, and identity-provider groups do not map
directly to application roles.

### Consequences and validation

Publication, digest, comparison, and rollback include roles and users. A user
must be active in the published application configuration and hold one of its
roles. Urgent access removal occurs at the identity provider and by ending
sessions, followed by a configuration publication. Validate WDES-027 and the
NFR-SEC-002 role matrix per application at Gate D.

**Approved by:** Mark Raysmith as Product/domain owner and Security owner on
2026-10-10.
