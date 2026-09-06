# GDFramework Dependency Inventory

**Status:** Repository-visible dependencies catalogued; installed/deployed versions pending  
**Version:** 0.1

| ID | Dependency | Observed use | Planned treatment | Evidence/status |
|---|---|---|---|---|
| DEP-001 | VB6 runtime and OLE Automation | All legacy projects | Replace; retain only approved coexistence automation | Deployed runtime inventory pending |
| DEP-002 | ADO 2.5 | Client, server, GUI, interfaces, harness | Replace with versioned tabular contracts; boundary adapter if required | Source verified |
| DEP-003 | CDO 1.21/MAPI | Logging and mail notification | Supported notification service | Production use pending |
| DEP-004 | Excel Automation 9.0/Office paths | Export | File generation without installed Office by default | Workflow evidence pending |
| DEP-005 | Microsoft Scripting Runtime | File/configuration/XML handling | Platform file APIs | Source verified |
| DEP-006 | `SecureLogPass` | Client/server/aggregator secret handling | Secret store; recover contract only if deployed | External binary/status pending |
| DEP-007 | GD internal COM binaries | Cross-project calls | Explicit modules/services plus temporary compatibility | Exact deployed identities pending |
| DEP-008 | GridEX 1.6/2.0 | Grid, popup, print/export | Modern grid behavior replacement | Both generations require characterization |
| DEP-009 | Microsoft Forms 2.0 | Popup/list UI | Replace; do not assume redistribution rights | Deployed use pending |
| DEP-010 | `MSCOMCTL.OCX`/`COMCTL32.OCX` | Toolbar, tab, tree, status, image list | Native modern controls | Source verified |
| DEP-011 | `RICHTX32.OCX` | Message/debug/control text | Replace and preserve supported markup | Source verified |
| DEP-012 | `COMDLG32.OCX` | File/color/font dialogs | Native supported dialogs | Source verified |
| DEP-013 | `MSCHRT20.OCX` | Chart view | Modern chart engine only if in scope | Feature unfinished/runtime verification pending |
| DEP-014 | `MSCAL.OCX` | Calendar popup | Supported date picker | Source verified |
| DEP-015 | `JSBBar16.OCX` | Active shell navigation | Replace from behavioral contract | Source verified; deployed version pending |
| DEP-016 | Sheridan `ssa3d30.ocx` | Custom-control rendering | Visual implementation detail | No direct modern dependency |
| DEP-017 | `MSDERUN.DLL` | Aggregator manifest | Verify use; do not migrate by assumption | Runtime evidence pending |
| DEP-018 | External RDS COM server | Example plugin | Exclude unless consumer evidence appears | Unavailable/source incomplete |

For every deployed dependency record exact version/hash, license/redistribution
status, installer/registration, consumers, owner, supported replacement, test
environment, and retirement condition.

