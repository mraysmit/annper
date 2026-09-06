# GDFramework Component Inventory

**Status:** Repository inventory complete; deployed status pending  
**Version:** 0.1  
**Date:** 6 September 2026

This inventory distinguishes supplied project membership from production use.
Detailed responsibilities and source lineage are normative in functional
specification sections 37, 40, and 42.

| ID | Manifest/family | Type and role | Repository disposition | Deployment evidence |
|---|---|---|---|---|
| CMP-001 | `GenData/AppGUI/GenFormDataGUI.vbp` | Standard EXE; active shell and generic UI candidate | Initial standard GUI membership baseline | Pending |
| CMP-002 | `GenData/AppGUI/GenFormDataGUI_Build.vbp` | Older Standard EXE build manifest | Historical/alternate | Retained `GFDGUI.exe` needs reconciliation |
| CMP-003 | `AppClient/GenFormDataClient.vbp` | ActiveX DLL; client facade | Initial standard client baseline | Pending |
| CMP-004 | `AppClient/GenFormDataClient_Build.vbp` | Older client DLL manifest | Historical/alternate | Pending |
| CMP-005 | `AppClient/AppClient/GenFormDataClient.vbp` | Duplicate nested client project | Broken-path lineage evidence | None |
| CMP-006 | `AppClient/AppClient/GenFormDataClient_Build.vbp` | Duplicate nested build project | Broken-path lineage evidence | None |
| CMP-007 | `AppServer/GenFormDataServer.vbp` | ActiveX DLL; server/data facade | Initial server membership candidate; divergent defects recorded | Pending |
| CMP-008 | `AppShared/GenFormDataServer.vbp` | Alternate server project/source | Repair/divergence evidence | Pending |
| CMP-009 | `AppServer/GDAggregator.vbp` | ActiveX DLL; aggregation | Compiled specialist candidate | Pending |
| CMP-010 | `AppShared/GDAggregator.vbp` | Duplicate aggregation manifest | Lineage evidence | Pending |
| CMP-011 | `AppControls/GFDGUICtls.vbp` | ActiveX Control library | Public control compatibility evidence | Pending |
| CMP-012 | `AppControls/test/Project1.vbp` | Standard EXE; panel smoke host | Development-only | Not production |
| CMP-013 | `AppInterfaces/GDFInterfaces.vbp` | ActiveX DLL; extension/shared contracts | Interface/type-library evidence | Pending |
| CMP-014 | `AppShared/IGDFramework.vbp` | Older marker/form interface DLL | Historical/alternate | Pending |
| CMP-015 | `Z_Harness_GDHelperDll/Z_Harness_GDHelperDll.vbp` | Helper validation harness DLL | Incomplete example | Not an oracle |
| CMP-016 | `Z_Harness_RDS_Plugin/RDS_Plugin.vbp` | Simple Service/RDS adapter example | Incomplete external example | Not core scope without consumer evidence |

## Required deployment fields

For every active component add: deployed path/machine, file hash, version,
LIBID/CLSID/ProgID, bitness, registration mechanism, calling applications,
configuration profile, owner, support criticality, and retirement disposition.

