# GDFramework Non-Functional Requirements

**Status:** Provisional measurable acceptance floor  
**Version:** 0.1  
**Date:** 6 September 2026

These targets replace unmeasurable phrases such as “performant,” “accessible,”
or “production ready.” They are initial migration acceptance floors, not a
commercial SLA. Production evidence may strengthen or revise a value through an
approved decision; a gate may not waive a target without recording the reason,
risk owner, compensating control, and expiry date.

## 1. Measurement profiles

| Profile | Initial definition |
|---|---|
| Interactive read | Up to 10,000 returned rows and 100 columns on the agreed production-like LAN fixture |
| Interactive change | One atomic change set of up to 100 inserted/updated/deleted rows |
| Large export | 100,000 rows and 100 columns to a supported file format |
| Concurrency | 50 simultaneously active user sessions with representative read/write mix |
| Client display | 1366×768 and 1920×1080 viewports at 100%, 125%, 150%, and 200% scaling |

Phase 1 shall replace these profiles with observed production percentiles and
retain the original profile for regression comparison.

## 2. Requirements

| ID | Area | Measurable target | Verification |
|---|---|---|---|
| NFR-PERF-001 | Interactive read | 95th percentile server response no more than 2 seconds and 99th percentile no more than 5 seconds for the interactive-read profile, excluding an explicitly asynchronous export/report | Timed provider integration test with warm and cold-cache results separated |
| NFR-PERF-002 | Client usability | First usable screen state no more than 3 seconds after a successful interactive response; user input remains responsive during operations longer than 500 ms | End-to-end workflow timing and UI responsiveness test |
| NFR-PERF-003 | Change execution | 95th percentile no more than 2 seconds for the interactive-change profile; timeout must produce an accurate rollback/unknown-outcome status | Transactional integration test |
| NFR-PERF-004 | Export | Complete the large-export profile within 60 seconds without requiring installed desktop Office software and without exceeding the approved process-memory limit | Production-shaped export test |
| NFR-SCALE-001 | Concurrency | Meet PERF targets at the concurrency profile with no cross-user/application data leakage and less than 1% unexpected failures | Load and isolation test |
| NFR-REL-001 | Atomicity | Zero partial commits for operations specified as atomic; every indeterminate provider outcome is reported distinctly and reconciled | Failure injection at each transaction boundary using real provider fixtures |
| NFR-REL-002 | Resource cleanup | Repeated cancellation, timeout, and provider failure produces no sustained growth in open connections, file handles, or temporary files across 1,000 operations | Soak test and resource counters |
| NFR-REL-003 | Recovery | Host restart restores service within 5 minutes without corrupting committed data or shared configuration | Restart/recovery exercise |
| NFR-AVAIL-001 | Availability | Initial service objective 99.9% monthly excluding approved maintenance; provider-specific outages are reported separately from host availability | Monitoring report after pilot |
| NFR-DR-001 | Recovery objectives | Initial RTO 4 hours and RPO 15 minutes for migration-owned configuration/state; application-database objectives inherit approved database policy | Documented restore exercise and owner approval |
| NFR-SEC-001 | Identity | 100% of protected operations derive identity from the trusted host; caller-supplied user/audit IDs never establish authority | Authentication/impersonation tests |
| NFR-SEC-002 | Authorization | Zero unauthorized dataset, field, command, administrative, or cross-application accesses in the controlled security suite | Role/claim matrix tests |
| NFR-SEC-003 | Injection and secrets | All values are parameterized; zero secrets/tokens/passwords in source, responses, UI diagnostics, or logs; dependency and secret scans pass | Static scan plus provider and log inspection |
| NFR-OBS-001 | Correlation | 100% of service operations and resulting provider calls/errors carry a correlation ID and stable outcome code | Contract and telemetry tests |
| NFR-OBS-002 | Diagnostics | For every failed operation, authorized support can identify operation, subject, dataset/provider, duration, category, and transaction outcome without exposing sensitive values | Failure-scenario inspection |
| NFR-ACC-001 | Accessibility | Every supported workflow is keyboard operable with visible focus and logical order; semantic names/roles/states are exposed through the selected platform accessibility API; a WCAG 2.2 AA-equivalent audit has no critical/serious issue | Automated scan plus manual keyboard and assistive-technology test |
| NFR-UI-001 | Scaling/layout | No clipped required content, overlapping controls, unreachable command, or unusable dialog at any client-display profile; reflow/scrolling is allowed where documented | Screenshot and interaction matrix |
| NFR-I18N-001 | Text and locale | Unicode round trips without loss; dates, times, numbers, and currency use an explicitly selected locale/time zone; invariant protocol values do not depend on workstation locale | Cross-locale contract/UI tests |
| NFR-COMP-001 | Compatibility | Every supported contract version and legacy adapter operation has an owner, deprecation date, telemetry, and passing differential fixture | Compatibility report and retirement dashboard |
| NFR-BUILD-001 | Reproducibility | A clean checkout on the pinned build image restores, builds, tests, and packages without machine-specific paths or pre-registered development components | CI clean-build job |

## 3. Open calibration evidence

The following evidence is still required and does not make the targets above
optional: production row/column distributions, peak concurrency, network
latency, export sizes, report duration, availability history, backup policy,
supported locales, accessibility platform, and business-approved RTO/RPO.

