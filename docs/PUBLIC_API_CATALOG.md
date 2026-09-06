# GDFramework Public API Catalogue

**Status:** Repository-visible control and extension contracts documented; full deployed COM extraction pending  
**Version:** 0.1

| Surface | Normative detail | Repository status | Required next evidence |
|---|---|---|---|
| Custom control library | Functional specification §26: exact properties, types/access, methods, event signatures, enums/numeric values, defaults, property bags, and UI consumers | 209 unique public declarations checked; no names absent from specification | Extract production OCX type library and compare DISPIDs/GUIDs/binary compatibility |
| Extension interfaces | Functional specification §24 | Source contracts documented | Deployed helper DLLs and type libraries |
| Client facade | Functional specification §§8–12, 15–23, 40–41 | Behavior catalogued; exact automation signature table incomplete | Production `GFDClient` type library: methods, parameter flags/types, return types, DISPIDs, GUIDs |
| Server facade | Functional specification §§16, 18, 22, 25, 27, 40–41 | Behavior catalogued; exact automation signature table incomplete | Production `GFDServer`/aggregator type libraries and registered classes |
| Shared interfaces/types | Functional specification §§24, 37, 40 | Project/source inventory complete | Reconcile source with deployed `GDFInterfaces` binary |
| GUI form contract | Functional specification §§9–15 and §26.9 | Active repository-visible behavior documented | Runtime form consumers, screenshots, external `IForm` callers |

## Required COM row format

Each extracted public member shall record component/version, LIBID, interface
IID, class CLSID/ProgID, member name, DISPID, invoke kind, parameter order,
ByVal/ByRef/optional/default flags, COM/VB type, return type, event source IID,
source evidence, deployed consumer, compatibility disposition, and test ID.

The exact production type library—not a source file name—is the authority for a
coexistence binary contract.

