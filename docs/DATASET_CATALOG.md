# GDFramework Dataset and Metadata Catalogue

**Status:** Metadata schema contract reconstructed; deployed row population and referenced database objects pending  
**Version:** 0.2

The catalogue structure below is inferred from the metadata database schema,
the metadata reference documents, the archived physical-object inventory, and
the fields and relationships consumed by the VB6 source. “Pending” means that
the active deployment's rows have not yet populated the catalogue; it does not
mean the metadata entity or its generic UI semantics are unknown.

| Catalogue area | Reconstructed schema/source | What deployed rows must supply | Status |
|---|---|---|---|
| Application groups/applications | `dsp_app_grp`, `dsp_app` | Every active group/application, startup/defaults, options, captions, ownership | Schema-defined; row population pending |
| Connections | `dsp_db` and connection profiles | Logical ID/name, provider, safe connection metadata, timeout, active consumers | Schema-defined; rows pending and secrets must be redacted |
| DataClasses | `dsp_dc_defn` | ID/name, source operation, connection, query/procedure, cursor/cache/refresh, update table, keys, audit/concurrency, consumers | Schema-defined; row population pending |
| Parameters | static, dynamic, additional parameter metadata | Ordered name/type/marker, source, default, required/write/security, refresh semantics | Schema-defined; row population pending |
| Navigation | group/application/menu/submenu metadata | Complete ordered navigation trees, icons, targets, personal-menu rules | Schema-defined; row population pending |
| Display definitions | `dsp_defn_ctl`, `dsp_scrn_defn` | One screen and element specification per active ID, view/options, captions, fields, commands | Schema-defined; row population pending |
| Security | user/role/application/display capability metadata | Sanitized users, roles, memberships, effective permissions, inactive/default cases | Schema-defined; row population pending |
| Reports/tree definitions | report, cross-tab, chart, tree metadata | Definition, input dataset, fields/groups/formats/output/action | Schema-defined; row population pending |
| Messages/system parameters | message and parameter metadata | Type/audience/time window, polling, configuration aliases/defaults | Schema-defined; row population pending |
| Database objects | referenced tables/views/procedures/functions | DDL, parameter/result schemas, side effects, permissions, dependencies | Pending per application database |
| External actions | helper/service class metadata | ProgID/interface, inputs/outputs/errors, consumers, deployment | Pending deployed component collection |

## Required DataClass record

Each active DataClass receives a stable catalogue ID and records its metadata
source row, provider/connection, operation text or procedure, parameter contract,
result schema, ordering/paging, cache/invalidation, security scope, update policy,
keys/stamps, business consumers, data classification, representative fixture,
requirement IDs, and acceptance-test IDs.

No deployed screen or business action may be declared completely specified until
all referenced DataClasses and database objects have catalogue records.
