# GDFramework Dataset and Metadata Catalogue

**Status:** Framework schema families identified; deployed rows and database objects pending  
**Version:** 0.1

| Catalogue area | Known metadata/source | What must be exported | Status |
|---|---|---|---|
| Application groups/applications | `dsp_app_grp`, `dsp_app` | Every active group/application, startup/defaults, options, captions, ownership | Pending database export |
| Connections | `dsp_db` and connection profiles | Logical ID/name, provider, safe connection metadata, timeout, active consumers | Pending; secrets must be redacted |
| DataClasses | `dsp_dc_defn` | ID/name, source operation, connection, query/procedure, cursor/cache/refresh, update table, keys, audit/concurrency, consumers | Pending |
| Parameters | static, dynamic, additional parameter metadata | Ordered name/type/marker, source, default, required/write/security, refresh semantics | Pending |
| Navigation | group/application/menu/submenu metadata | Complete ordered navigation trees, icons, targets, personal-menu rules | Pending |
| Display definitions | `dsp_defn_ctl`, `dsp_scrn_defn` | One screen and element specification per active ID, view/options, captions, fields, commands | Pending |
| Security | user/role/application/display capability metadata | Sanitized users, roles, memberships, effective permissions, inactive/default cases | Pending |
| Reports/tree definitions | report, cross-tab, chart, tree metadata | Definition, input dataset, fields/groups/formats/output/action | Pending |
| Messages/system parameters | message and parameter metadata | Type/audience/time window, polling, configuration aliases/defaults | Pending |
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

