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
$SpecPath = Join-Path $DocsRoot 'annper-functional-specification.md'
$DesignPath = Join-Path $DocsRoot 'annper-modern-web-system-design.md'
$MasterPath = Join-Path $DocsRoot 'annper-migration-master.md'
$AdrPath = Join-Path $DocsRoot 'annper-architecture-decisions.md'
$ControlPath = Join-Path $DocsRoot 'annper-document-control.md'
$TraceabilityPath = Join-Path $DocsRoot 'annper-requirements-traceability.md'
$errors = @()

# ---- required controlled documents and allowed working guides
$expectedDocs = @('annper-document-control.md', 'annper-functional-specification.md', 'annper-migration-master.md', 'annper-modern-web-system-design.md', 'annper-architecture-decisions.md')
$allowedDocs = @($expectedDocs) + @('annper-deployment-guide.md', 'annper-requirements-traceability.md')
$actualDocs = Get-ChildItem -LiteralPath $DocsRoot -Recurse -File | ForEach-Object { $_.Name } | Sort-Object
foreach ($name in $expectedDocs) {
    if ($name -notin $actualDocs) { $errors += "docs folder is missing controlled document: $name" }
}
foreach ($name in $actualDocs) {
    if ($name -notin $allowedDocs) { $errors += "docs folder contains an unclassified document: $name" }
}
$missingRequired = @($expectedDocs | Where-Object { $_ -notin $actualDocs }).Count
foreach ($path in @($TraceabilityPath, (Join-Path $ProjectRoot 'README.md'), (Join-Path $ProjectRoot 'baseline\legacy-source.sha256'), (Join-Path $ProjectRoot 'baseline\legacy-source-manifest.sha256'))) {
    if (-not (Test-Path -LiteralPath $path)) { $errors += "required file is missing: $([IO.Path]::GetRelativePath($ProjectRoot, $path))"; $missingRequired++ }
}
# The remaining checks read these files; report what is missing instead of failing on a path.
if ($missingRequired -gt 0) {
    $errors | ForEach-Object { Write-Output "ERROR: $_" }
    exit 1
}

# ---- tables, links, machine paths
$markdownFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Filter '*.md' | Where-Object { $_.FullName -notlike '*\.git\*' -and $_.FullName -notlike '*\.history\*' }
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
# record in annper-migration-master.md section 9.1 (the ${LEGACY_SOURCE_ROOT} evidence-root row),
# which CONTRIBUTING.md names explicitly.
$uncExemptRow = '^\|\s*`\$\{LEGACY_SOURCE_ROOT\}`\s*\|'
foreach ($file in $markdownFiles) {
    $docLines = Get-Content -LiteralPath $file.FullName
    for ($i = 0; $i -lt $docLines.Count; $i++) {
        if ($file.Name -eq 'annper-migration-master.md' -and $docLines[$i] -match $uncExemptRow) { continue }
        if ($uncPattern.IsMatch($docLines[$i])) { $errors += "$($file.Name):$($i + 1) embeds a share path; only annper-migration-master.md section 9.1 may record the reviewed location" }
    }
}

# ---- controlled IDs
$specRaw = Get-Content -LiteralPath $SpecPath -Raw
$designRaw = Get-Content -LiteralPath $DesignPath -Raw
$masterRaw = Get-Content -LiteralPath $MasterPath -Raw
$adrRaw = Get-Content -LiteralPath $AdrPath -Raw
$controlRaw = Get-Content -LiteralPath $ControlPath -Raw
$traceabilityRaw = Get-Content -LiteralPath $TraceabilityPath -Raw

# ---- document versions: header, register (control section 3), and cross-document citations agree
function Get-HeaderVersion {
    param([string]$Raw)
    if ($Raw -match '(?m)^\*\*Version:\*\*\s*(\d+\.\d+)') { return $Matches[1] }
    if ($Raw -match '(?m)^\|\s*Version\s*\|\s*(\d+\.\d+)\s*\|') { return $Matches[1] }
    if ($Raw -match '(?m)^(?:\*\*Status:\*\*|Document status:)[^\r\n]*?baseline (\d+\.\d+)') { return $Matches[1] }
    return $null
}
$headerVersions = @{
    'annper-functional-specification.md' = Get-HeaderVersion $specRaw
    'annper-modern-web-system-design.md' = Get-HeaderVersion $designRaw
    'annper-migration-master.md' = Get-HeaderVersion $masterRaw
    'annper-architecture-decisions.md' = Get-HeaderVersion $adrRaw
    'annper-document-control.md' = Get-HeaderVersion $controlRaw
}
foreach ($name in $headerVersions.Keys) { if (-not $headerVersions[$name]) { $errors += "$name header does not state a version" } }
$registerBlock = if ($controlRaw -match '(?s)## 3\. Document register(.*?)## 4\.') { $Matches[1] } else { '' }
$registerMap = @{
    'annper-functional-specification.md' = '^\|\s*Functional specification'
    'annper-modern-web-system-design.md' = '^\|\s*Modern web system design'
    'annper-migration-master.md' = '^\|\s*Migration master'
    'annper-architecture-decisions.md' = '^\|\s*Architecture decision records'
    'annper-document-control.md' = '^\|\s*Document control'
}
foreach ($name in $registerMap.Keys) {
    $rowMatch = [regex]::Match($registerBlock, '(?m)' + $registerMap[$name] + '[^|]*\|\s*(\d+\.\d+)\s*/')
    if (-not $rowMatch.Success) { $errors += "annper-document-control.md section 3 has no register row for $name"; continue }
    if ($headerVersions[$name] -and $rowMatch.Groups[1].Value -ne $headerVersions[$name]) { $errors += "annper-document-control.md section 3 lists $name as $($rowMatch.Groups[1].Value) but its header says $($headerVersions[$name])" }
}
# README "Current status" must state the same versions as the document headers.
$readmeRaw = Get-Content -LiteralPath (Join-Path $ProjectRoot 'README.md') -Raw
$readmeMap = @{
    'annper-functional-specification.md' = 'Functional specification: Controlled working baseline (\d+\.\d+)'
    'annper-modern-web-system-design.md' = 'Modern web system design: Controlled working baseline (\d+\.\d+)'
    'annper-migration-master.md' = 'Migration master: Controlled working baseline (\d+\.\d+)'
    'annper-architecture-decisions.md' = 'Architecture decision records: Controlled working baseline (\d+\.\d+)'
    'annper-document-control.md' = 'Document control: Controlled working baseline (\d+\.\d+)'
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

# ---- traceability artifact is present, generated, and current
if ($traceabilityRaw -notmatch '(?s)<!-- BEGIN GENERATED TRACEABILITY -->(.*?)<!-- END GENERATED TRACEABILITY -->') {
    $errors += 'annper-requirements-traceability.md lacks the generated traceability block'
    $traceIds = @()
} else {
    $traceBlock = $Matches[1]
    $traceIds = [regex]::Matches($traceBlock, '(?m)^\|\s*((?:FR|NFR|DEF|WDES)-[A-Z0-9-]+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
    foreach ($id in ($allIds | Where-Object { $_ -notin $traceIds })) { $errors += "Controlled ID missing from traceability: $id" }
    foreach ($id in ($traceIds | Where-Object { $_ -notin $allIds })) { $errors += "Traceability ID absent from its source document: $id" }
    foreach ($duplicate in $traceIds | Group-Object | Where-Object Count -gt 1) { $errors += "Duplicate traceability ID: $($duplicate.Name)" }
    if ($traceBlock -match 'UNMAPPED PREFIX') { $errors += 'Traceability contains unmapped requirement prefixes; update Build-ControlledArtifacts.ps1' }
    foreach ($row in [regex]::Matches($traceBlock, '(?m)^\|\s*((?:FR|NFR|DEF|WDES)-[A-Z0-9-]+)\s*\|[^\r\n]*\bUnassigned\b')) {
        $errors += "Traceability row $($row.Groups[1].Value) has no delivery phase; cite it in a governance-plan quality gate or map its prefix in Build-ControlledArtifacts.ps1"
    }

    # Freshness: regenerate the artifact in a scratch copy and require a byte-identical block.
    $scratch = Join-Path ([IO.Path]::GetTempPath()) ('annper-trace-' + [guid]::NewGuid().ToString('N'))
    try {
        foreach ($sub in @('docs', 'baseline', 'tools')) { Copy-Item -LiteralPath (Join-Path $ProjectRoot $sub) -Destination (Join-Path $scratch $sub) -Recurse -Force }
        & (Join-Path $scratch 'tools\Build-ControlledArtifacts.ps1') -ProjectRoot $scratch -SkipBaseline 3>$null | Out-Null
        $regenerated = (Get-Content -LiteralPath (Join-Path $scratch 'docs\annper-requirements-traceability.md') -Raw) -replace "`r`n", "`n"
        $regeneratedBlock = if ($regenerated -match '(?s)<!-- BEGIN GENERATED TRACEABILITY -->(.*?)<!-- END GENERATED TRACEABILITY -->') { $Matches[1] } else { '' }
        if (($traceBlock -replace "`r`n", "`n") -ne $regeneratedBlock) { $errors += 'annper-requirements-traceability.md is stale; run tools/Build-ControlledArtifacts.ps1' }
    } finally {
        if (Test-Path -LiteralPath $scratch) {
            $scratchTarget = (Resolve-Path -LiteralPath $scratch).ProviderPath
            $scratchTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
            if (-not $scratchTarget.StartsWith($scratchTempRoot, [StringComparison]::OrdinalIgnoreCase) -or
                [IO.Path]::GetFileName($scratchTarget) -notmatch '^annper-trace-[a-f0-9]{32}$') {
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
foreach ($record in @(
    @{ Name = 'annper-document-control.md'; Raw = $controlRaw; Label = 'Reviewed source-manifest SHA-256' },
    @{ Name = 'annper-requirements-traceability.md'; Raw = $traceabilityRaw; Label = 'Legacy manifest SHA-256' }
)) {
    $manifestRecord = [regex]::Match($record.Raw, ('(?m)^\*\*{0}:\*\*\s*`([a-f0-9]{{64}})`' -f [regex]::Escape($record.Label)))
    if (-not $manifestRecord.Success -or $manifestRecord.Groups[1].Value -ne $actualIdentity) {
        $errors += "$($record.Name) does not record the current manifest identity $actualIdentity"
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
