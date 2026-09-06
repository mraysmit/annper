# GDFramework Provider Compatibility Matrix

**Status:** Source capabilities identified; production use and real integration evidence pending  
**Version:** 0.1

| Legacy type | Provider/source | Source capability | Production status | Required compatibility evidence | Initial disposition |
|---:|---|---|---|---|---|
| 1 | Sybase through ADO/ODBC | Implemented | Unknown | Connection, parameter types, null/date/decimal/binary, procedure, transaction, timeout/reconnect | Decide in D-004 |
| 2 | SQL Server through SQLOLEDB | Implemented | Unknown | Same core matrix plus identity/generated key and affected-row/concurrency behavior | Candidate first provider; unapproved |
| 3 | Oracle 8+ ADO provider | Implemented | Unknown | Named/positional binding, dates/decimals, procedure/ref-cursor behavior, transaction/error mapping | Decide in D-004 |
| 4 | Microsoft Access through ODBC | Implemented | Unknown | File locking, concurrency, types, generated keys, multi-row transaction limits | Decide in D-004 |
| 5 | XML file/blob | Implemented | Unknown | ADO XML schema/data fidelity, encoding, null/type/order, file failure and cleanup | Decide in D-004 |
| 6 | Simple Service helper DLL | Implemented adapter boundary; retained harness incomplete | Unknown | Deployed helper protocol, connect/query/disconnect, serialization, failure and cleanup | Exclude unless active consumer proven |
| Historical/future | DCOM, Excel reader, delimited text, Trade Server | Documented intention only | Unknown | Implementation and active metadata/consumer | Excluded until proven |

## Common provider test matrix

Every approved provider must pass actual serialization, typed binding, injection
resistance, null/empty distinction, Unicode, date/time zone, decimal precision,
binary data, deterministic ordering, row limits, stored procedure, generated
key, optimistic concurrency, commit/rollback, cancellation, timeout, reconnect,
resource cleanup, safe diagnostics, and representative performance tests.

