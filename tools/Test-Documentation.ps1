param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$LegacySourceRoot = $env:LEGACY_SOURCE_ROOT
)

# Validates the controlled document set. Repository-local checks always run.
# Legacy source-path checks run only when LEGACY_SOURCE_ROOT resolves; otherwise
# they are reported as skipped rather than failing the run.

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
$DocsRoot = Join-Path $ProjectRoot 'docs'
$SpecPath = Join-Path $DocsRoot 'GDFramework Functional Specification.md'
$DesignPath = Join-Path $DocsRoot 'GDF_MODERN_WEB_SYSTEM_DESIGN.md'
$MasterPath = Join-Path $DocsRoot 'GDF_MIGRATION_MASTER.md'
$ControlPath = Join-Path $DocsRoot 'GDF_DOCUMENT_CONTROL.md'
$errors = @()

# ---- the controlled set is exactly four documents
$expectedDocs = @('GDF_DOCUMENT_CONTROL.md', 'GDFramework Functional Specification.md', 'GDF_MIGRATION_MASTER.md', 'GDF_MODERN_WEB_SYSTEM_DESIGN.md')
$actualDocs = Get-ChildItem -LiteralPath $DocsRoot -Recurse -File | ForEach-Object { $_.Name } | Sort-Object
$diff = Compare-Object -ReferenceObject $expectedDocs -DifferenceObject @($actualDocs)
foreach ($d in $diff) { $errors += "docs folder must contain exactly the four controlled documents; unexpected/missing: $($d.InputObject)" }

# ---- tables, links, machine paths
$markdownFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Filter '*.md' | Where-Object { $_.FullName -notlike '*\.git\*' }
$pipeRegex = [regex]'(?<!\\)\|'
foreach ($file in $markdownFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    $inTable = $false; $expectedPipes = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\|') {
            $pipeCount = $pipeRegex.Matches($lines[$i]).Count
            if (-not $inTable) { $inTable = $true; $expectedPipes = $pipeCount }
            if ($pipeCount -ne $expectedPipes) { $errors += "$($file.Name):$($i + 1) table has $pipeCount pipes; expected $expectedPipes" }
        } else { $inTable = $false; $expectedPipes = 0 }
    }
    $raw = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($match in [regex]::Matches($raw, '\[[^\]]+\]\(([^)]+)\)')) {
        $link = $match.Groups[1].Value
        if ($link -match '^(https?://|mailto:)') { continue }
        $pathPart = [uri]::UnescapeDataString(($link -replace '#.*$', ''))
        # A bare "#anchor" link resolves against the current document.
        $target = if ($pathPart) { Join-Path $file.DirectoryName $pathPart } else { $file.FullName }
        if (-not (Test-Path -LiteralPath $target)) { $errors += "$($file.Name) has missing local link: $link"; continue }
        if ($link -match '#(.+)$' -and $target -like '*.md') {
            $anchor = $Matches[1]
            $headings = [regex]::Matches((Get-Content -LiteralPath $target -Raw), '(?m)^#{1,6}\s+(.+?)\s*$') | ForEach-Object {
                (($_.Groups[1].Value.ToLowerInvariant() -replace '[^\p{L}\p{N}\s_-]', '') -replace '\s', '-')
            }
            if ($anchor -notin $headings) { $errors += "$($file.Name) links to missing anchor: $link" }
        }
    }
}
$machinePaths = Select-String -Path $markdownFiles.FullName -Pattern 'C:\\Users\\|(?<![A-Za-z])[A-Z]:\\Documents' -AllMatches
foreach ($match in $machinePaths) { $errors += "$($match.Filename):$($match.LineNumber) contains a machine-specific path" }
$toolFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'tools') -Filter '*.ps1'
$uncPattern = [regex]('\\' + '\\' + '[A-Za-z0-9_-]+' + '\\')
foreach ($tool in $toolFiles) {
    $toolLines = Get-Content -LiteralPath $tool.FullName
    for ($i = 0; $i -lt $toolLines.Count; $i++) {
        if ($toolLines[$i] -match 'uncPattern|-Pattern ') { continue }   # regex definitions, not paths
        if ($uncPattern.IsMatch($toolLines[$i])) { $errors += "$($tool.Name):$($i + 1) embeds a UNC path in build logic" }
    }
}
# Documents may not carry share paths either. The one exemption is the reviewed-location
# record in GDF_MIGRATION_MASTER.md section 23.1 (the ${LEGACY_SOURCE_ROOT} evidence-root row),
# which CONTRIBUTING.md names explicitly.
$uncExemptRow = '^\|\s*`\$\{LEGACY_SOURCE_ROOT\}`\s*\|'
foreach ($file in $markdownFiles) {
    $docLines = Get-Content -LiteralPath $file.FullName
    for ($i = 0; $i -lt $docLines.Count; $i++) {
        if ($file.Name -eq 'GDF_MIGRATION_MASTER.md' -and $docLines[$i] -match $uncExemptRow) { continue }
        if ($uncPattern.IsMatch($docLines[$i])) { $errors += "$($file.Name):$($i + 1) embeds a share path; only GDF_MIGRATION_MASTER.md section 23.1 may record the reviewed location" }
    }
}

# ---- controlled IDs
$specRaw = Get-Content -LiteralPath $SpecPath -Raw
$designRaw = Get-Content -LiteralPath $DesignPath -Raw
$masterRaw = Get-Content -LiteralPath $MasterPath -Raw
$controlRaw = Get-Content -LiteralPath $ControlPath -Raw

# ---- document versions: header, register (control section 3), and cross-document citations agree
function Get-HeaderVersion {
    param([string]$Raw)
    if ($Raw -match '(?m)^\*\*Version:\*\*\s*(\d+\.\d+)') { return $Matches[1] }
    if ($Raw -match '(?m)^(?:\*\*Status:\*\*|Document status:)[^\r\n]*?baseline (\d+\.\d+)') { return $Matches[1] }
    return $null
}
$headerVersions = @{
    'GDFramework Functional Specification.md' = Get-HeaderVersion $specRaw
    'GDF_MODERN_WEB_SYSTEM_DESIGN.md' = Get-HeaderVersion $designRaw
    'GDF_MIGRATION_MASTER.md' = Get-HeaderVersion $masterRaw
    'GDF_DOCUMENT_CONTROL.md' = Get-HeaderVersion $controlRaw
}
foreach ($name in $headerVersions.Keys) { if (-not $headerVersions[$name]) { $errors += "$name header does not state a version" } }
$registerBlock = if ($controlRaw -match '(?s)## 3\. Document register(.*?)## 4\.') { $Matches[1] } else { '' }
$registerMap = @{
    'GDFramework Functional Specification.md' = '^\|\s*Functional specification'
    'GDF_MODERN_WEB_SYSTEM_DESIGN.md' = '^\|\s*Modern web system design'
    'GDF_MIGRATION_MASTER.md' = '^\|\s*Migration master'
    'GDF_DOCUMENT_CONTROL.md' = '^\|\s*Document control'
}
foreach ($name in $registerMap.Keys) {
    $rowMatch = [regex]::Match($registerBlock, '(?m)' + $registerMap[$name] + '[^|]*\|\s*(\d+\.\d+)\s*/')
    if (-not $rowMatch.Success) { $errors += "GDF_DOCUMENT_CONTROL.md section 3 has no register row for $name"; continue }
    if ($headerVersions[$name] -and $rowMatch.Groups[1].Value -ne $headerVersions[$name]) { $errors += "GDF_DOCUMENT_CONTROL.md section 3 lists $name as $($rowMatch.Groups[1].Value) but its header says $($headerVersions[$name])" }
}
# README "Current status" must state the same versions as the document headers.
$readmeRaw = Get-Content -LiteralPath (Join-Path $ProjectRoot 'README.md') -Raw
$readmeMap = @{
    'GDFramework Functional Specification.md' = 'Functional specification: Controlled working baseline (\d+\.\d+)'
    'GDF_MODERN_WEB_SYSTEM_DESIGN.md' = 'Modern web system design: Controlled working baseline (\d+\.\d+)'
    'GDF_MIGRATION_MASTER.md' = 'Migration master: Controlled working baseline (\d+\.\d+)'
    'GDF_DOCUMENT_CONTROL.md' = 'Document control: Controlled working baseline (\d+\.\d+)'
}
foreach ($name in $readmeMap.Keys) {
    if ($readmeRaw -notmatch $readmeMap[$name]) { $errors += "README.md current status has no version line for $name"; continue }
    if ($headerVersions[$name] -and $Matches[1] -ne $headerVersions[$name]) { $errors += "README.md lists $name as $($Matches[1]) but its header says $($headerVersions[$name])" }
}
foreach ($file in $markdownFiles) {
    $raw = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($cite in [regex]::Matches($raw, '\[[^\]]*?\b(?:Specification|Design|Control)\s+(\d+\.\d+)\]\(([^)#]+\.md)(?:#[^)]*)?\)')) {
        $targetName = [IO.Path]::GetFileName([uri]::UnescapeDataString($cite.Groups[2].Value))
        if ($headerVersions.ContainsKey($targetName) -and $headerVersions[$targetName] -and $cite.Groups[1].Value -ne $headerVersions[$targetName]) {
            $errors += "$($file.Name) cites $targetName as version $($cite.Groups[1].Value); its header says $($headerVersions[$targetName])"
        }
    }
}

$requirementIds = [regex]::Matches($specRaw, '(?m)^\|\s*(FR-[A-Z0-9-]+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$nfrIds = [regex]::Matches($specRaw, '(?m)^\|\s*(NFR-[A-Z0-9-]+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$defectIds = [regex]::Matches($specRaw, '(?m)^\|\s*(DEF-\d+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$designIds = [regex]::Matches($designRaw, '(?m)^\|\s*(WDES-\d+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$allIds = @($requirementIds) + @($nfrIds) + @($defectIds) + @($designIds)
foreach ($duplicate in $allIds | Group-Object | Where-Object Count -gt 1) { $errors += "Duplicate controlled ID: $($duplicate.Name)" }

# Active acceptance scenarios must not require a withdrawn/not-applicable NFR.
$notApplicableNfrIds = [regex]::Matches($specRaw, '(?m)^\|\s*(NFR-[A-Z0-9-]+)\s*\|[^\r\n]*NOT APPLICABLE[^\r\n]*$') | ForEach-Object { $_.Groups[1].Value }
foreach ($scenario in [regex]::Matches($specRaw, '(?m)^\|\s*(FR-ACC-\d+)\s*\|[^\r\n]*$')) {
    foreach ($id in $notApplicableNfrIds) {
        if ($scenario.Value -match ('\b' + [regex]::Escape($id) + '\b')) {
            $errors += "$($scenario.Groups[1].Value) cites not-applicable requirement $id; keep it outside active acceptance"
        }
    }
}

foreach ($family in @(@{Name='D';Pattern='(?m)^\|\s*(D-\d{3})\s*\|'}, @{Name='R';Pattern='(?m)^\|\s*(R-\d{3})\s*\|'}, @{Name='EV';Pattern='(?m)^\|\s*(EV-\d{3}A?)\s*\|'}, @{Name='CMP';Pattern='(?m)^\|\s*(CMP-\d{3})\s*\|'}, @{Name='DEP';Pattern='(?m)^\|\s*(DEP-\d{3})\s*\|'})) {
    $ids = [regex]::Matches($masterRaw, $family.Pattern) | ForEach-Object { $_.Groups[1].Value }
    foreach ($duplicate in $ids | Group-Object | Where-Object Count -gt 1) { $errors += "Duplicate $($family.Name) register ID: $($duplicate.Name)" }
}

# ---- the defect register holds durable dispositions
foreach ($m in [regex]::Matches($specRaw, '(?m)^\|\s*(DEF-\d+)\s*\|(.*)$')) {
    $cells = ($m.Groups[2].Value -split '(?<!\\)\|')
    if ($cells.Count -lt 6) { $errors += "$($m.Groups[1].Value) row lacks Decision/Approvers/Approval-date columns" ; continue }
    $decision = $cells[2].Trim()
    if ($decision -notin @('Pending','Preserve','Fix','Retire')) { $errors += "$($m.Groups[1].Value) has an invalid decision '$decision' (Pending, Preserve, Fix, or Retire)" }
}

# ---- traceability section is present, generated, and current
if ($controlRaw -notmatch '(?s)<!-- BEGIN GENERATED TRACEABILITY -->(.*?)<!-- END GENERATED TRACEABILITY -->') {
    $errors += 'GDF_DOCUMENT_CONTROL.md lacks the generated traceability section'
    $traceIds = @()
} else {
    $traceBlock = $Matches[1]
    $traceIds = [regex]::Matches($traceBlock, '(?m)^\|\s*((?:FR|NFR|DEF|WDES)-[A-Z0-9-]+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
    foreach ($id in ($allIds | Where-Object { $_ -notin $traceIds })) { $errors += "Controlled ID missing from traceability: $id" }
    foreach ($id in ($traceIds | Where-Object { $_ -notin $allIds })) { $errors += "Traceability ID absent from its source document: $id" }
    foreach ($duplicate in $traceIds | Group-Object | Where-Object Count -gt 1) { $errors += "Duplicate traceability ID: $($duplicate.Name)" }
    if ($traceBlock -match 'UNMAPPED PREFIX') { $errors += 'Traceability contains unmapped requirement prefixes; update Build-ControlledArtifacts.ps1' }

    # Freshness: regenerate section 8 into a scratch copy of the project and require a byte-identical block.
    $scratch = Join-Path ([IO.Path]::GetTempPath()) ('gdf-trace-' + [guid]::NewGuid().ToString('N'))
    try {
        foreach ($sub in @('docs', 'baseline', 'tools')) { Copy-Item -LiteralPath (Join-Path $ProjectRoot $sub) -Destination (Join-Path $scratch $sub) -Recurse -Force }
        & (Join-Path $scratch 'tools\Build-ControlledArtifacts.ps1') -ProjectRoot $scratch -SkipBaseline 3>$null | Out-Null
        $regenerated = (Get-Content -LiteralPath (Join-Path $scratch 'docs\GDF_DOCUMENT_CONTROL.md') -Raw) -replace "`r`n", "`n"
        $regeneratedBlock = if ($regenerated -match '(?s)<!-- BEGIN GENERATED TRACEABILITY -->(.*?)<!-- END GENERATED TRACEABILITY -->') { $Matches[1] } else { '' }
        if (($traceBlock -replace "`r`n", "`n") -ne $regeneratedBlock) { $errors += 'GDF_DOCUMENT_CONTROL.md section 8 is stale; run tools/Build-ControlledArtifacts.ps1' }
    } finally {
        if (Test-Path -LiteralPath $scratch) {
            $scratchTarget = (Resolve-Path -LiteralPath $scratch).ProviderPath
            $scratchTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
            if (-not $scratchTarget.StartsWith($scratchTempRoot, [StringComparison]::OrdinalIgnoreCase) -or
                [IO.Path]::GetFileName($scratchTarget) -notmatch '^gdf-trace-[a-f0-9]{32}$') {
                throw "Refusing to remove an unexpected traceability scratch path: $scratchTarget"
            }
            Remove-Item -LiteralPath $scratchTarget -Recurse -Force
        }
    }
}

# ---- cross-document linkage rules
foreach ($id in $nfrIds) {
    if ($designRaw -notmatch [regex]::Escape($id)) { $errors += "Design does not cite $id" }
    if ($masterRaw -notmatch [regex]::Escape($id)) { $errors += "Migration master does not cite $id" }
}
$evIds = [regex]::Matches($masterRaw, '(?m)^\|\s*(EV-\d{3}A?)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$gateBlock = if ($masterRaw -match '(?s)## \d+\. Quality gates(.*?)## \d+\.') { $Matches[1] } else { '' }
foreach ($id in $evIds) { if ($gateBlock -notmatch [regex]::Escape($id)) { $errors += "Quality gates do not reference evidence package $id" } }
# Decisions the design is not required to cite, with the reason. Every other D-* row must appear in the design.
$designCitationExempt = @{
    'D-006' = 'closed: not applicable; no legacy consumer or compatibility adapter exists'
    'D-009' = 'canonical legacy source is a Phase 0 provenance decision with no design content'
    'D-010' = 'application database schema policy is decided per authored application; no legacy database exists'
    'D-011' = 'defect disposition policy is exercised in the functional specification section 31, not the design'
    'D-012' = 'closed: not applicable; no side-by-side deployment exists to route between'
}
foreach ($id in ([regex]::Matches($masterRaw, '(?m)^\|\s*(D-\d{3})\s*\|') | ForEach-Object { $_.Groups[1].Value })) {
    if ($designCitationExempt.ContainsKey($id)) { continue }
    if ($designRaw -notmatch [regex]::Escape($id)) { $errors += "Design does not reference open decision $id" }
}

# ---- checksum manifest identity
$checksumPath = Join-Path $ProjectRoot 'baseline\legacy-source.sha256'
$identityPath = Join-Path $ProjectRoot 'baseline\legacy-source-manifest.sha256'
$expectedIdentity = ((Get-Content -LiteralPath $identityPath -Raw).Trim() -split '\s+')[0]
$actualIdentity = (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualIdentity -ne $expectedIdentity) { $errors += "Checksum manifest identity mismatch: expected $expectedIdentity; actual $actualIdentity" }
foreach ($doc in @($SpecPath, $DesignPath, $MasterPath, $ControlPath)) {
    $documentRaw = Get-Content -LiteralPath $doc -Raw
    $firstSection = [regex]::Match($documentRaw, '(?m)^##\s')
    $documentHeader = if ($firstSection.Success) { $documentRaw.Substring(0, $firstSection.Index) } else { $documentRaw }
    $manifestHeader = [regex]::Match($documentHeader, '(?m)^(?:\*\*)?Legacy checksum-manifest SHA-256:(?:\*\*)?\s*`([a-f0-9]{64})`')
    if (-not $manifestHeader.Success -or $manifestHeader.Groups[1].Value -ne $actualIdentity) {
        $errors += "$([IO.Path]::GetFileName($doc)) header does not record the current manifest identity $actualIdentity"
    }
}

# ---- legacy source references (only when the evidence tree is reachable)
$exactReferenceCount = 0; $invalidReferenceCount = 0; $sourceCheck = 'skipped (LEGACY_SOURCE_ROOT unset or unreachable)'
$sourceMatches = [regex]::Matches($specRaw, '(?<path>\.\./(?:\.\./)?[^`,;]+?\.(?:frm|bas|cls|ctl|pag|vbp|ini|sql|doc|xls|ppt))(?::(?<start>\d+)(?:-(?<end>\d+))?)?')
if (-not [string]::IsNullOrWhiteSpace($LegacySourceRoot) -and (Test-Path -LiteralPath $LegacySourceRoot)) {
    $LegacyDocsRoot = Join-Path (Resolve-Path -LiteralPath $LegacySourceRoot).ProviderPath 'Docs'
    $sourceCheck = 'run'
    foreach ($match in $sourceMatches) {
        $relative = $match.Groups['path'].Value
        if ($relative -match '[*?]') { continue }
        $exactReferenceCount++
        $fullPath = [IO.Path]::GetFullPath((Join-Path $LegacyDocsRoot $relative))
        if (-not (Test-Path -LiteralPath $fullPath)) { $errors += "Missing exact source reference: $relative"; $invalidReferenceCount++; continue }
        if ($match.Groups['start'].Success) {
            $lineCount = (Get-Content -LiteralPath $fullPath).Count
            $end = if ($match.Groups['end'].Success) { [int]$match.Groups['end'].Value } else { [int]$match.Groups['start'].Value }
            if ($end -gt $lineCount) { $errors += "Out-of-range source reference: $($match.Value); file has $lineCount lines"; $invalidReferenceCount++ }
        }
    }
}

[pscustomobject]@{
    MarkdownFiles = $markdownFiles.Count
    FunctionalRequirements = $requirementIds.Count
    NonFunctionalRequirements = $nfrIds.Count
    LegacyDefects = $defectIds.Count
    DesignVerifications = $designIds.Count
    TraceabilityRows = $traceIds.Count
    SourceReferenceCheck = $sourceCheck
    ExactSourceReferences = $exactReferenceCount
    InvalidSourceReferences = $invalidReferenceCount
    Errors = $errors.Count
    ManifestSHA256 = $actualIdentity
}
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Output "ERROR: $_" }
    exit 1
}
