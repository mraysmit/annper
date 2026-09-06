# GDFramework Legacy Baseline

**Status:** Initial controlled repository snapshot; production identity unproven  
**Version:** 0.1  
**Captured:** 6 September 2026

## 1. Evidence roots

| Token/scope | Reviewed location | Portable use |
|---|---|---|
| `${LEGACY_SOURCE_ROOT}` | `\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework` | Configure externally; do not embed the machine path in build logic |
| GUI sibling | `${LEGACY_SOURCE_ROOT}/../GenData/AppGUI` | Included because the active shell/generic UI is outside the core root |

The source is evidence, not yet proven to be the production-deployed source.
Checksums establish exactly what was reviewed; they do not prove deployment.

## 2. Reproducible inventory rule

The source-size measurement recursively includes `.frm`, `.bas`, `.cls`,
`.ctl`, and `.pag` physical files, including duplicates and source-only files.
It excludes binaries, resource sidecars, documents, archives, and project files
from line counts but includes all files in the checksum inventory.

| Scope | VB source files | Physical lines |
|---|---:|---:|
| Core GDFramework tree | 123 | 55,504 |
| Core plus `GenData/AppGUI` | 160 | 79,100 |
| Supplied `.vbp` manifests across both scopes | 16 | Not applicable |

## 3. Generated baseline evidence

| Artifact | Purpose |
|---|---|
| `../baseline/legacy-file-inventory.csv` | Path, size, timestamp, extension, and SHA-256 for every captured file |
| `../baseline/legacy-source.sha256` | Portable checksum list using scope-relative paths |
| `../baseline/legacy-source-manifest.sha256` | SHA-256 identity of the checksum list itself |

Current checksum-manifest identity:
`fc29779b9588a41cb9da10c486f1f0b35ca2108baf50fb8892086587ee320027`.

Regenerate these only through `tools/Build-ControlledArtifacts.ps1`. A changed
manifest requires review of affected requirements and a new controlled baseline
version.

## 4. Known provenance limitations

- Standard, build, duplicate, shared, source-only, archive, and binary lineages
  disagree.
- The retained GUI executable aligns with an older build manifest, not enough to
  identify the active standard source.
- External OCXs, helpers, database metadata, registration state, and production
  deployment manifests remain incomplete.
- Current hashes identify the reviewed files only; deployed binary hashes must
  be added when collected.

## 5. Phase 0 exit evidence still required

- Production deployment and COM registration inventory.
- Controlled legacy VM/build instructions and dependency media.
- Source-to-deployed-binary reconciliation.
- Named owners and approval for the canonical first-slice source.
- Active consumer/application inventory.
