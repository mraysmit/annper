# GDFramework Deployed-Application Evidence Acquisition

**Status:** Active discovery register  
**Version:** 0.2  
**Date:** 6 September 2026

The metadata database schema has been reconstructed in functional specification
section 28 and is sufficient to define how metadata drives the generic
application. The evidence below is needed to instantiate that known model for
named deployments and to verify physical database and runtime details. These
are controlled gate inputs, not optional research tasks.

| ID | Evidence package | Owner | Priority/gate | Secure collection and completion criterion | Status |
|---|---|---|---|---|---|
| EV-001 | Active GD metadata row population | Database owner | Critical / Gate B | Read-only export of sanitized rows for every populated metadata table; preserve IDs, relationships, ordering, option values, and inactive records needed for interpretation; secrets redacted and separately referenced | Schema model complete; deployed rows pending |
| EV-001A | Production metadata physical DDL | Database owner | High / before replacement metadata persistence | DDL confirms exact physical types, nullability, defaults, indexes, uniqueness, foreign-key enforcement, cascades, triggers, and deployment-specific additions against functional specification section 28 | Logical schema inferred; physical confirmation pending |
| EV-002 | Referenced application database objects | Database owner | Critical / Gate B per slice | DDL for tables/views/procedures/functions, result schemas, permissions, dependencies, and side effects for every active DataClass/action | Pending |
| EV-003 | Reproducible legacy runtime | Legacy technical owner | Critical / Gate B | Controlled VM/image, OS/runtime/OCX registration, installers, configuration template, build/run instructions, and repeatable selected scenarios | Pending |
| EV-004 | Deployed EXE/DLL/OCX/type libraries | Operations owner | Critical / Gate A | File hashes, versions, LIBIDs/CLSIDs/ProgIDs, bitness, registered locations, machine/application consumers, and deployment manifest | Pending |
| EV-005 | Helper/service/plugin implementations | Legacy technical owner | High / affected slice | Binary/type library/configuration, protocol behavior, inputs/outputs/failures, owner, consumers, and safe fixture | Pending |
| EV-006 | Effective role/user matrix | Security owner | Critical / Gate B | Sanitized representative subjects covering active/inactive/default/admin/denied/cross-application cases and effective command/data access | Pending |
| EV-007 | Production volume and service characteristics | Operations owner | High / Gate E calibration | Row/column/export distributions, concurrency, latency, refresh intervals, timeouts, availability, backup/RTO/RPO, and peak periods | Pending |
| EV-008 | User workflows and visual evidence | UI/workflow owner | High / Gate B and Phase 6 | Screen recordings/screenshots plus task narratives for every active application, popup, keyboard path, export/print flow, and known relied-upon quirk | Pending |
| EV-009 | Active consumer/deployment inventory | Operations owner | Critical / Gate A | Every process/machine/user group activating GD COM components, frequency/criticality, owner, configuration profile, and retirement path | Pending |
| EV-010 | Business behavior interviews | Product/domain owner | High / Gate B | Decisions on ambiguous behavior and every legacy defect, with linked requirement/defect IDs and named approver | Pending |

## Collection controls

- Work from read-only snapshots or transactionally consistent exports.
- Never place live passwords, access tokens, private keys, or unredacted
  connection strings in this repository.
- Hash every binary/export and record collection time, source system, tool,
  collector, sanitization, and retention/access policy.
- Preserve source identifiers and referential relationships when data is
  sanitized.
- Add each accepted item to the appropriate catalogue and requirement rows.
- A package is complete only when another authorized team member can reproduce
  or inspect it from the recorded instructions.

The absence of EV-001 rows does not reopen the metadata schema model. It limits
only the enumeration of actual deployed applications, screens, DataClasses,
permissions, reports, and user-specific configuration. EV-001A may refine
physical storage details but may not silently change the functional semantics
already reconstructed from schema and source evidence.

## Application-completeness rule

A deployed application may be marked fully specified only when it has:

1. application/group and security catalogue entries;
2. complete navigation and screen definitions;
3. every field/control/command and DataClass mapped;
4. referenced database/helper behavior documented;
5. representative role-based runtime evidence;
6. acceptance scenarios and test IDs; and
7. no unresolved critical metadata, runtime, or defect-disposition gap.
