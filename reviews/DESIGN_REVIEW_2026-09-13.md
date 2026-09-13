# Review of GDFramework Modern Web System Design 0.5

**Review date:** 13 September 2026  
**Reviewed artifact:** `docs/MODERN_WEB_SYSTEM_DESIGN.md`, controlled working design baseline 0.5  
**Reviewed against:** GD Framework Functional Specification 0.9; GDFramework Rebuild Master Plan and Design 0.8; GDFramework Migration Document Control 0.5 (precedence per DOCUMENT_CONTROL.md section 1)  
**Repository state:** commit `5eb409c`, working tree clean  
**Validator:** `tools/Test-Documentation.ps1` reports 0 errors (462 FR, 20 NFR, 38 DEF, 16 WDES rows; source-path checks skipped because `LEGACY_SOURCE_ROOT` is unset)  
**Status of this review:** Reviewer findings for the owners named in DOCUMENT_CONTROL.md section 7. It is not a controlled document and lives outside the four-document set.

## 1. Verdict

The design is coherent, technology-neutral, and consistent with the rebuild premise wherever it matters: no coexistence layer, server authority, typed contracts, authoring first, and every open choice mapped to a decision in MIGRATION_MASTER.md section 17. Its structure, vocabulary, and decision references are sound, and the requirement traceability generated from it is complete.

The findings below are of three kinds:

- **Precedence conflicts (section 2).** Places where the design departs from a `VERIFIED` functional requirement without a recorded disposition. Under DOCUMENT_CONTROL.md section 1 the functional requirement prevails until a DEF-* decision, a D-017 reinterpretation, or an ADR changes it, so these must be resolved before approval.
- **Internal inconsistencies and stale wording (section 3).** Statements inside the design that contradict each other or the rebuild premise adopted on 10 September 2026.
- **Gaps (section 4).** Behaviors the specification requires that the design does not yet address.

Recommendation: resolve RV-001 to RV-004 and RV-008 before the design is presented for approval; treat the rest as inputs to design 0.6.

Severity scale: **High** blocks approval or would mislead implementation; **Medium** must be resolved before the affected phase; **Low** is editorial or can be resolved in the next version.

## 2. Precedence conflicts with the functional specification

| ID | Severity | Design location | Conflicting requirement | Finding | Recommended action |
|---|---|---|---|---|---|
| RV-001 | High | §8.5 Layout | FR-ELEM-002, FR-FIELD-002 (`VERIFIED`) | The specification requires explicit top/left positions to be converted to device-independent units and honored. The design treats them as "ordering and grouping hints, not raw pixel coordinates". No DEF-* row and no section 32.1 row covers the change. | Either add a section 32.1 row so the reinterpretation is approved under D-017, or honor explicit coordinates on wide viewports and reflow only below a stated breakpoint. |
| RV-002 | High | §14.6 Change execution | FR-DML-006, FR-INV-003 (`REPLACEMENT REQUIREMENT`) | The specification requires a fail-safe so one row operation never affects more than one database row. §14.6 covers zero affected rows but is silent on more than one. | Add: an affected-row count greater than one on a single-row update or delete is a failure; the transaction rolls back and the outcome is reported as `failed`. Add the case to the §29 provider-integration and reliability layers. |
| RV-003 | Medium | §7.3 Navigation; §9 component table | FR-NAV-008 as rewritten in specification 0.9 | Both places still gate arbitrary-depth navigation on "discovery evidence" proving "an active consumer". Specification 0.9 replaced that condition with a recorded product decision under D-017 because no consumer exists. | Replace the evidence wording in §7.3 and §9 with "only where D-017 requires it". |
| RV-004 | Medium | §8.1 Compiled screen definition; §11.3 Compilation step 2 | FR-INV-010 | FR-INV-010 requires legacy option strings to become named capabilities. §11.3 normalizes "option arrays/bit fields" and §8.1 reports "translated legacy options", which implies authors still write positional `Y/N` strings. The authored model is therefore ambiguous. GD Studio in the prototype implies named capabilities. | State the authored model explicitly: named capabilities are authored and stored; the section 28 positional grammar is lineage only, and the compiler never receives positional strings. Adjust §8.1 and §11.3 wording accordingly. |
| RV-005 | Low | §7.2 Application selection | FR-SEC-004 (`VERIFIED`) | The design adds "or a choice page is shown" when no default application is marked. The specification says the first authorized application is used. | Remove the choice page, or record the difference as an intentional usability change with a decision reference. |
| RV-006 | Medium | §19 Messages and real-time behavior; §12.7 Message service | Specification section 23 message table; FR-SHUT-005; FR-ACC-016 | The specification defines six message intents (client message box, immediate client shutdown, dataset refresh, form refresh, polling-frequency change, generic message) and FR-ACC-016 requires all of them tested. §19 gives examples only and does not name immediate shutdown, dataset-refresh marking, or polling-frequency change. | Add a table mapping each legacy intent to a target message type and its handling. State how immediate shutdown interacts with the §7.4 unsaved-change protocol (expected: item 4, safest notice then discard). |
| RV-007 | Medium | §11.1 Parameter domain; §13.4; §17 | Specification section 16.2 parameter type 3 (database object / dynamic SQL fragment) | The design rejects raw SQL fragments everywhere but never says what replaces parameter type 3. | State that type 3 compiles to an allow-listed identifier chosen from the definition (or is rejected at compilation), and cite it in §11.3 step 5. |

## 3. Internal inconsistencies and stale wording

| ID | Severity | Design location | Finding | Recommended action |
|---|---|---|---|---|
| RV-008 | Medium | Appendix D, security NFR row | Cites "§28.5". Section 28 became delivery sequencing in 0.5 and has only subsections 28.1 to 28.3. | Point at §28.3 (application databases and least-privilege identities) or drop the reference. |
| RV-009 | Low | §7.3 ("the default and imported model"); §7.7 layout and messages rows ("imported as a diagnostic", "imported with a diagnostic"); §11.4 ("as any automated import"); §14.2 ("should normally be migrated") | Nothing exists to import or migrate. These are remnants of the pre-0.5 premise. | Reword to "authored" or "configured"; in §14.2 say "isolated in a controlled worker" only. |
| RV-010 | Medium | §35 Definition of implementation-ready | Item 3 requires approved ADRs for deployment and test environments, and item 5 requires threat models, before a slice starts. MIGRATION_MASTER.md Gate C allows D-003 to be deferred with a safe default, and Phase 3 entry is "Gate C passed". The design is stricter than the plan that governs sequencing. | Align §35 with Gate C: list D-001, D-004, D-005, D-008, D-013 as required and D-002, D-003, D-007, D-014 as decided or deferred with a safe default. Move threat-model items to Phase 3 activities if they are wanted. |
| RV-011 | Low | §8.2 Screen lifecycle diagram | No path from LoadingDefinition to Ready. Action screens (FR-ACTION-001) and no-data-load option 19 (FR-SCREEN-009) reach Ready without a query. | Add the edge `LoadingDefinition --> Ready: no initial load`. |
| RV-012 | Low | §7.4 Workspace tabs; §12.6 Preference service | §12.6 scopes preferences by navigation item per FR-CUSTOM-008, but §7.4 keys tabs by screen and subkey only. A screen reached from two navigation items has two personalizations but one tab. | Include the originating navigation item in tab identity when the definitions differ, or state that the first-opened item's preferences apply until the tab closes. |
| RV-013 | Low | §26 and §27 Satisfies lines | Wildcards FR-CTL-*, FR-PROJ-*, FR-DEP-*, FR-CMD-*, FR-BUILD-* include rows that specification 0.9 marks `NOT APPLICABLE` (for example FR-CTL-API-001/002/004, FR-PROJ-004, FR-DEP-002/004, FR-CMD-007/010, FR-BUILD-012). | Exclude the not-applicable rows or add "(not-applicable rows excepted)". |
| RV-014 | Low | §9 Web component equivalence | `CSFPDropDown` and `CSFPTextLookup` are mapped unconditionally. FR-CTL-USE-005 and FR-CTL-LU-006 make their use in the generic screen a D-017 choice, as §34 already records. | Mark those two rows "conditional on D-017". |
| RV-015 | Low | Whole document | Only DEF-001, DEF-003, and DEF-038 are cited, although the design also implements the proposed Fix for DEF-005 (personal menus in every navigation mode, §7.3), DEF-012 (immediate removal after logical delete), and DEF-013 (server-value reconciliation, Appendix A.2). | Cite those rows where the behavior is designed so the D-011 dependency is visible. |
| RV-016 | Low | §8.3 prototype note | The prototype's "Run limit check" screen is part of the first application (MIGRATION_MASTER.md section 3.5), while D-020 defaults limit processing out of scope. | State that it is a plain Action DataClass exercising screen type 4, not Limit Server behavior under D-020. |

## 4. Gaps

| ID | Severity | Requirement | Finding | Recommended action |
|---|---|---|---|---|
| RV-017 | Medium | FR-DML-010 | Framework-managed key allocation has no concurrency-safe design; §11.1 lists only "ID allocation lineage". | Specify the allocation mechanism (database sequence or leased block per application/table) and its behavior under concurrent inserts and rollback. |
| RV-018 | Low | FR-DC-005 | Initialization DataClasses that load at startup are not mentioned in §7.6. | State whether startup preloading exists in the web runtime or is replaced by first-access loading, and record the difference if the latter. |
| RV-019 | Low | FR-SEC-009, FR-SHUT-002 | Last-login and last-logout tracking are absent from §12.1 and §15.5. | Add them to the session service or the audit record. |
| RV-020 | Low | FR-SEC-008 | User-specific display-option overrides are absent from the §15.2 authorization inputs. | Add "subject-level overrides of role results" to the list, or state that the rebuild retires them under D-011. |
| RV-021 | Low | FR-SEC-002, FR-SEC-003 | The design does not say what happens when an authenticated identity-provider subject has no metadata mapping or no active application assignment. | Add the outcome to §7.6 step 3 (blocking security message; no application data loaded). |

## 5. Observations outside the design

These were found while cross-checking and belong to the other documents' owners.

- Specification FR-INV-012, DOCUMENT_CONTROL.md section 1, and the MIGRATION_MASTER.md 0.7 change-history row still say "Phase 6". Phases were reduced to 0 to 5 in master 0.8.
- Specification FR-ACC-006 lists NFR-COMP-001 in its Verifies column although section 44 marks that requirement `NOT APPLICABLE`.
- Design §29 and MIGRATION_MASTER.md section 11 use different test-layer names (the master has Characterization, UI/control behavior, and Operational; the design has Component, Workflow, Deployment, and others). They are complementary rather than contradictory, but a mapping sentence in one of them would prevent a future reader treating them as two test strategies.

## 6. Suggested disposition

| Action | Owner (DOCUMENT_CONTROL.md section 7) | Target |
|---|---|---|
| RV-001, RV-003, RV-014, RV-016 | Product/domain owner with the UI/workflow owner (D-017 scope) | Design 0.6; D-017 decision at Gate B |
| RV-002, RV-007, RV-017 | Migration technical lead | Design 0.6 |
| RV-004 | Migration technical lead with the Product/domain owner (D-015 authoring model) | Design 0.6 |
| RV-005, RV-006, RV-011, RV-012, RV-018 to RV-021 | Migration technical lead | Design 0.6 |
| RV-008, RV-009, RV-013, RV-015 | Migration technical lead | Design 0.6 (editorial) |
| RV-010 | Migration technical lead | Design 0.6, aligned with master section 18 Gate C |
| Section 5 items | Product/domain owner (specification); Test/quality owner (document control); Migration technical lead (master) | Next version of each |

After the design changes, regenerate DOCUMENT_CONTROL.md section 8 with `tools/Build-ControlledArtifacts.ps1 -SkipBaseline` and re-run `tools/Test-Documentation.ps1`.

## 7. Re-review of design 0.6 (13 September 2026)

**Reviewed state:** uncommitted working tree on top of `5eb409c`: design 0.6, specification 0.10, master 0.9, document control 0.6, README updated. `tools/Test-Documentation.ps1` reports 0 errors; section 8 was regenerated (536 rows, FR-ELEM-002 and FR-FIELD-002 now carry the D-017 pending status).

**Verdict:** every finding in sections 2 to 5 is resolved or explicitly deferred to the decision that owns it, and no pending D-017 or DEF-* decision has been approved by the edits, which is the correct posture. The design can go to the section 7 approvers. Five low-severity follow-ups (N-01 to N-05) were introduced by the changes and can be taken in design 0.7 or during approval.

### 7.1 Status of each finding

| ID | Status | Where resolved | Note |
|---|---|---|---|
| RV-001 | Resolved as pending decision | Design §8.5 rewritten to state the FR-ELEM-002/FR-FIELD-002 baseline and mark the responsive reinterpretation as a candidate; §7.7 gains an "Element coordinates" row; specification §32.1 gains the matching row; FR-ELEM-002 and FR-FIELD-002 reclassified `REPLATFORM DECISION (D-017)`; master D-017 row lists element coordinates | See N-02 |
| RV-002 | Resolved | Design §14.6 multi-row fail-safe paragraph; §29 provider-integration and reliability layers extended | Wording is strong and testable |
| RV-003 | Resolved | Design §7.3 and §9 now cite D-017 | |
| RV-004 | Resolved | Design §8.1 states that authors store named capabilities and §11.3 step 2 rejects positional strings; specification FR-INV-010 reworded to drop the importer | See N-04 |
| RV-005 | Resolved | Design §7.2 choice page removed | |
| RV-006 | Resolved | Design §19 six-row intent table with handling, including immediate shutdown under §7.4 item 4 and FR-SHUT-005 | |
| RV-007 | Resolved | Design §11.3 "Parameter type 3 replacement" paragraph; step 5 references it | |
| RV-008 | Resolved | Appendix D cites §28.3 | |
| RV-009 | Resolved | Remaining uses of "import" and "migrated" are factual statements about the premise or about database and state migration, not legacy import | |
| RV-010 | Resolved | Design §35 items 3, 5, and 6 aligned with master Gate C; master Phase 2 entry now lists D-015 and D-016; master Phase 3 activity 9 carries the threat-model work | |
| RV-011 | Resolved | §8.2 gains `LoadingDefinition --> Ready`; Appendix A.1 gains the no-load branch | |
| RV-012 | Resolved | Design §7.4 includes the originating navigation item in tab identity | See N-03 |
| RV-013 | Resolved | §26 and §27 Satisfies lines except not-applicable rows | |
| RV-014 | Resolved | §9 rows marked conditional on D-017 with a clarifying paragraph | |
| RV-015 | Resolved | DEF-005 cited in §7.3; DEF-012 and DEF-013 cited in §14.6 and Appendix A.2 as candidates pending D-011 | |
| RV-016 | Resolved | §8.3 states Run limit check is a plain Action DataClass | |
| RV-017 | Resolved | §14.6 framework-managed key allocation paragraph; §29 layers extended | |
| RV-018 | Resolved | §7.6 step 7 | See N-05 |
| RV-019 | Resolved | §12.1 login/logout recording | |
| RV-020 | Resolved | §15.2 user-specific display-option override | |
| RV-021 | Resolved | §7.6 step 3 and §12.1 | |
| Section 5, Phase 6 | Resolved | FR-INV-012 and DOCUMENT_CONTROL.md §1 now say Gate B; the master 0.7 and control 0.4 change-history rows keep the historical wording deliberately, which is acceptable for immutable history rows | |
| Section 5, NFR-COMP-001 | Resolved | FR-ACC-006 rewritten to exclude not-applicable rows and no longer cites NFR-COMP-001 | |
| Section 5, test layers | Resolved | Mapping sentence added to both master §11 and design §29 | |

### 7.2 New observations from the 0.6 changes

| ID | Severity | Location | Observation | Recommended action |
|---|---|---|---|---|
| N-01 | Low | Change-history rows of all four documents | The rows cite "RV-001..021", but this review lives in `reviews/`, which is untracked and outside the controlled set, so the citation dangles for anyone reading the documents from git. | Commit `reviews/DESIGN_REVIEW_2026-09-13.md` in the same commit and cite its path in the change-history rows, or describe the changes without the RV identifiers. |
| N-02 | Low | Specification §32.1 introduction | The introduction defines desktop-bound behavior as depending on "a desktop process, the workstation, a local file system, an installed Office application, or an operating-system window". A twips-based layout model does not fit that sentence, so the new coordinate row sits outside the section's own definition. | Extend the sentence with "or the desktop layout model (twips)" so the row is covered by the definition it appears under. |
| N-03 | Low | Design §7.4 | The navigation item is now always part of tab identity, while the preceding bullet says metadata controls whether multiple instances of a screen are allowed. A single-instance screen reached from two navigation items would open twice. | State the precedence: when a screen is single-instance, the existing tab is activated and keeps the preferences of the item that opened it; the navigation item joins tab identity only when multiple instances are allowed. |
| N-04 | Low | Design §8.1; specification FR-INV-010 | Both refer to "the section 28 mapping" from positional options to named capabilities. No single mapping table exists; the positional tables are in specification §15 (screen and extended options), §28.1 (application-group options), and §28.6. | Cite §§15 and 28.1/28.6, or add one consolidated mapping table to §28 so the reference resolves. |
| N-05 | Low | Design §7.6 step 7 | "Load authorized initialization DataClasses" does not say what loading means in the web model: a server-side cache warm, a client prefetch into screen state, or both. | State which it is and where the loaded data lives (expected: server-side warm of the cache scoped to the session, with no client-held rows until a screen requests them). |

### 7.3 Disposition

| Action | Owner | Target |
|---|---|---|
| N-01 | Test/quality owner (document control) | Before commit |
| N-02, N-04 | Product/domain owner (specification) | Specification 0.11 |
| N-03, N-05 | Migration technical lead | Design 0.7 |

## 8. Third pass (13 September 2026, later)

**Reviewed state:** still uncommitted on top of `5eb409c`. Version numbers are unchanged (design 0.6, specification 0.10, master 0.9, document control 0.6), which is correct because the edits are clarifications within the same unapproved versions. `tools/Test-Documentation.ps1` reports 0 errors.

**Verdict:** all five section 7.2 observations are resolved. No new issues were introduced. Nothing further is outstanding from this review; the document set is ready for the section 7 approvers once the working tree is committed.

| ID | Status | Where resolved |
|---|---|---|
| N-01 | Resolved | The RV identifiers were removed from every change-history row; the rows now describe the changes in their own words, so nothing in the controlled set depends on this file |
| N-02 | Resolved | Specification §32.1 introduction now includes "explicit element-coordinate placement requiring a responsive-layout decision", so the coordinate row falls within the section's definition |
| N-03 | Resolved | Design §7.4 states that the single-instance rule takes precedence; the navigation item joins tab identity only when multiple instances are allowed, and the first-opening item's preference scope stays attached until the tab closes |
| N-04 | Resolved | Design §8.1 and specification FR-INV-010 cite sections 15, 28.1, and 28.6 as the lineage of the mapping; those sections do hold the screen options, application-group options, and display option flags respectively. §8.1 also ties unresolved positional meanings to FR-TOOL-007 |
| N-05 | Resolved | Design §7.6 step 7 defines initialization as a server-side execution into a bounded, scoped initialization cache under §14.7 policy, with no browser prefetch and explicit failure/retry |

Editorial only, no action required: §7.6 step 7 is now a nine-line paragraph inside a numbered list; it would read more easily as a short step with the cache rules moved to §14.7.

**Recommended next step:** commit the five modified documents together with this review file in one commit, so the change-history rows and the review they answer share a revision.
