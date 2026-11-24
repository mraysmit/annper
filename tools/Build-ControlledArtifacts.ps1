param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$LegacySourceRoot = $env:LEGACY_SOURCE_ROOT,
    [switch]$SkipBaseline
)

# Regenerates the controlled, derived artifacts:
#   baseline/legacy-file-inventory.csv, baseline/legacy-source.sha256,
#   baseline/legacy-source-manifest.sha256     (only when the legacy tree is reachable)
#   docs/annper-requirements-traceability.md          (generated traceability matrix)
# Output is deterministic for a given set of inputs: the matrix header date is the
# latest header date of its source documents, never the time of generation.

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
$BaselineRoot = Join-Path $ProjectRoot 'baseline'
$DocsRoot = Join-Path $ProjectRoot 'docs'
$SpecPath = Join-Path $DocsRoot 'annper-functional-specification.md'
$DesignPath = Join-Path $DocsRoot 'annper-modern-web-system-design.md'
$MasterPath = Join-Path $DocsRoot 'annper-migration-master.md'
$ControlPath = Join-Path $DocsRoot 'annper-document-control.md'
$TraceabilityPath = Join-Path $DocsRoot 'annper-requirements-traceability.md'

foreach ($required in @($BaselineRoot, $DocsRoot, $SpecPath, $DesignPath, $MasterPath, $ControlPath)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Required path is missing: $required" }
}

$inventoryPath = Join-Path $BaselineRoot 'legacy-file-inventory.csv'
$checksumPath = Join-Path $BaselineRoot 'legacy-source.sha256'
$manifestIdentityPath = Join-Path $BaselineRoot 'legacy-source-manifest.sha256'

function Get-RelativePortablePath {
    param([string]$BasePath, [string]$FullPath)
    [IO.Path]::GetRelativePath($BasePath, $FullPath).Replace('\', '/')
}

# ---------------------------------------------------------------- baseline
$baselineRegenerated = $false
if (-not $SkipBaseline -and -not [string]::IsNullOrWhiteSpace($LegacySourceRoot) -and (Test-Path -LiteralPath $LegacySourceRoot)) {
    $LegacySourceRoot = (Resolve-Path -LiteralPath $LegacySourceRoot).ProviderPath
    $GuiRoot = (Resolve-Path -LiteralPath (Join-Path (Split-Path $LegacySourceRoot -Parent) 'GenData\AppGUI')).ProviderPath

    $inventory = @()
    foreach ($scope in @(
        @{ Name = 'GDFramework'; Root = $LegacySourceRoot },
        @{ Name = 'GenData/AppGUI'; Root = $GuiRoot }
    )) {
        foreach ($file in Get-ChildItem -LiteralPath $scope.Root -Recurse -File | Sort-Object FullName) {
            $inventory += [pscustomobject]@{
                Scope = $scope.Name
                RelativePath = Get-RelativePortablePath -BasePath $scope.Root -FullPath $file.FullName
                Extension = $file.Extension
                Length = $file.Length
                SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
    }
    $inventory | Export-Csv -LiteralPath $inventoryPath -NoTypeInformation -Encoding utf8
    $checksumLines = $inventory | ForEach-Object { '{0} *{1}/{2}' -f $_.SHA256, $_.Scope, $_.RelativePath }
    Set-Content -LiteralPath $checksumPath -Value $checksumLines -Encoding utf8
    $manifestHash = (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $manifestIdentityPath -Value "$manifestHash *legacy-source.sha256" -Encoding utf8
    $baselineRegenerated = $true
} else {
    Write-Warning 'LEGACY_SOURCE_ROOT is unset or unreachable; reusing the committed checksum baseline.'
    $manifestHash = (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $recorded = ((Get-Content -LiteralPath $manifestIdentityPath -Raw).Trim() -split '\s+')[0]
    if ($recorded -ne $manifestHash) { throw "Committed manifest identity $recorded does not match legacy-source.sha256 ($manifestHash)" }
}

# ------------------------------------------------- requirement prefix maps
# Every FR prefix in the functional specification must appear here. The
# validator fails on any prefix that is missing, so the map cannot go stale.
$sourceMap = @{
    'START'='Startup and option constants; Main initialization'
    'SPLASH'='Main initialization; Startup and option constants'
    'SHUT'='Global toolbar/export/shutdown'
    'APP'='Message presentation and application switching; Client/server startup and security'
    'SEC'='Client/server startup and security; Display configuration/security assembly'
    'SHELL'='Shell layout and declarations; Main initialization; Global toolbar/export/shutdown'
    'NAV'='Menu loading; Navigation selection and screen creation; Personal menu editing; Client user/menu/layout persistence'
    'WIN'='Docking/tabs/resize; Modal screen contract'
    'SCREEN'='Screen configuration lifecycle; Generic screen states/enums'
    'ELEM'='Grid metadata construction; Dynamic parameters and criteria'
    'FIELD'='Grid metadata construction; Dynamic parameters and criteria'
    'CUSTOM'='Personal screen configuration; Grid context/customization'
    'TOOL'='Generic toolbar command routing; Toolbar generation and view selection'
    'ACTION'='Command buttons/popups/calendar; Generic toolbar command routing'
    'DIALOG'='Message presentation and application switching; Command buttons/popups/calendar'
    'LOOKUP'='Command buttons/popups/calendar; Panel/splitter/dropdown/lookup'
    'DC'='Server initialization and dataset catalog; Server data facade'
    'PARAM'='Dynamic parameters and criteria; Server initialization and dataset catalog'
    'JOIN'='Runtime dataset joining'
    'MD'='Field and master-detail views'
    'JUNCTION'='Field and master-detail views; Grid add/read/update events'
    'TREE'='Field and master-detail views; Navigation selection and screen creation'
    'FILTER'='Filtering/search; Grid context/customization'
    'SEARCH'='Filtering/search'
    'CRIT'='Dynamic parameters and criteria; Filtering/search'
    'DML'='CRUD and refresh; DML generation/execution; Grid add/read/update events'
    'INSERT'='CRUD and refresh; DML generation/execution; Grid add/read/update events'
    'UPDATE'='CRUD and refresh; DML generation/execution; Grid add/read/update events'
    'DELETE'='CRUD and refresh; DML generation/execution'
    'REFRESH'='CRUD and refresh; Client messaging/polling'
    'GRID'='Grid metadata construction; Grid context/customization'
    'REPORT'='Report/cross-tab processing'
    'EXCEL'='Global toolbar/export/shutdown; Report/cross-tab processing'
    'PRINT'='Report/cross-tab processing'
    'CHART'='Functional specification §§13.7, 21 and component catalogue'
    'MSG'='Message presentation and application switching'
    'SYSMSG'='Client messaging/polling'
    'LOG'='Functional specification §§22, 40 and client/server logging sources'
    'SYSINFO'='Functional specification §§22, 40 and system-information sources'
    'EXT'='Extension interfaces'
    'CONN'='Connection/query/cache/transactions'
    'CTL'='Complete custom-control API, defaults, persistence, events, and internal support state; Shell and generic-form custom-control integration'
    'AGG'='Aggregation engine'
    'LIMIT'='Limit-processing server'
    'META'='Functional specification §28 reconstructed metadata schema; configured instances are authored (D-015) and the platform physical schema is decided under D-013'
    'PROJ'='Project membership/build variants'
    'DEP'='Functional specification §38 and project references'
    'CMD'='Command parser and option constants'
    'STATE'='Support collections/value objects'
    'BUILD'='Functional specification §§37, 42 and binary/type-library lineage evidence'
    'PLM'='Historical PLM scope and gaps'
    'ARCH'='Functional specification §6 system context and logical architecture'
    'INV'='Functional specification §32 cross-cutting invariant'
    'ACC'='Functional specification §33 acceptance scenario'
}
$phaseMap = @{
    'Phase 0 baseline' = @('PROJ','DEP','BUILD')
    'Phase 3 first slice; Phase 4 expansion' = @('CTL','TOOL','NAV','WIN','ELEM','FIELD','SHELL','SCREEN','GRID','CHART','PRINT','EXCEL','CUSTOM','LOOKUP','DIALOG','SPLASH','SHUT','MD','TREE','JUNCTION','ACTION','EXT','CONN','DC','PARAM','JOIN','DML','INSERT','UPDATE','DELETE','REFRESH','MSG','SYSMSG','LOG','SYSINFO','REPORT','FILTER','SEARCH','CRIT','SEC','APP','START','STATE')
    'Phase 2 foundation' = @('META','CMD')
    'All phases; verified at each gate' = @('INV','ARCH')
    'Out of scope under D-020 (ADR-003); no delivery phase unless D-020 is reopened' = @('AGG','LIMIT','PLM')
}
# Acceptance scenarios (FR-ACC-*) and NFRs take their phase from the quality gates
# that cite them (governance plan section 5), so the matrix cannot drift from the gates.
$gateCitedPrefixes = @('ACC')
function Get-RequirementPrefix { param([string]$Id) if ($Id -match '^FR-([A-Z0-9]+)-') { return $Matches[1] }; return '' }
function Get-TargetPhase { param([string]$Prefix) foreach ($k in $phaseMap.Keys) { if ($Prefix -in $phaseMap[$k]) { return $k } }; return 'Unassigned' }

# ------------------------------------------------------ quality-gate citations
$gatePhases = [ordered]@{
    'A' = 'Phase 0 baseline (Gate A)'
    'B' = 'Phase 1 behavior decided (Gate B)'
    'C' = 'Phase 2 foundation (Gate C)'
    'D' = 'Phase 3 vertical slice (Gate D)'
    'E' = 'Phase 4 platform capability (Gate E)'
    'F' = 'Phase 5 release readiness (Gate F)'
}
$masterRaw = Get-Content -LiteralPath $MasterPath -Raw
if ($masterRaw -notmatch '(?s)## \d+\. Quality gates(.*?)(?:\r?\n## \d+\.|\z)') { throw "$MasterPath has no Quality gates section" }
$gateSection = $Matches[1]
$gateCitations = @{}
foreach ($gate in [regex]::Matches($gateSection, '(?ms)^### Gate ([A-Z])\b(.*?)(?=^### Gate |\z)')) {
    $letter = $gate.Groups[1].Value; $text = $gate.Groups[2].Value
    $ids = @([regex]::Matches($text, '\b(?:FR|NFR|DEF|WDES)(?:-[A-Z0-9]+)+\b') | ForEach-Object { $_.Value })
    # Expand ranges such as FR-ACC-001..FR-ACC-018 or DEF-001..DEF-038.
    foreach ($range in [regex]::Matches($text, '\b((?:FR|NFR|DEF|WDES)(?:-[A-Z]+)*)-(\d+)\.\.\1-(\d+)\b')) {
        $width = $range.Groups[2].Value.Length
        foreach ($n in [int]$range.Groups[2].Value..[int]$range.Groups[3].Value) { $ids += '{0}-{1}' -f $range.Groups[1].Value, $n.ToString().PadLeft($width, '0') }
    }
    foreach ($id in $ids) {
        if (-not $gateCitations.ContainsKey($id)) { $gateCitations[$id] = @() }
        if ($letter -notin $gateCitations[$id]) { $gateCitations[$id] += $letter }
    }
}
function Get-GatePhase {
    param([string]$Id)
    if (-not $gateCitations.ContainsKey($Id)) { return 'Unassigned: no quality gate cites this ID' }
    return (@($gatePhases.Keys | Where-Object { $_ -in $gateCitations[$Id] } | ForEach-Object { $gatePhases[$_] }) -join '; ')
}
function Escape-MarkdownCell { param([string]$Value) if ($null -eq $Value) { return '' }; return $Value.Replace('|','\|').Replace("`r",' ').Replace("`n",' ') }

# ------------------------------------------------------------ parse sources
$rows = @()
$unmappedPrefixes = @()
$section = ''; $subsection = ''; $lineNumber = 0
foreach ($line in Get-Content -LiteralPath $SpecPath) {
    $lineNumber++
    if ($line -match '^## (\d+\. .+)$') { $section = $Matches[1]; $subsection = ''; continue }
    if ($line -match '^### (\d+\.\d+ .+)$') { $subsection = $Matches[1]; continue }
    $location = if ($subsection) { $subsection } else { $section }

    if ($line -match '^\|\s*(FR-[A-Z0-9-]+)\s*\|.*\|\s*([^|]+?)\s*\|\s*$') {
        $id = $Matches[1]; $classification = $Matches[2].Trim()
        $prefix = Get-RequirementPrefix $id
        if (-not $sourceMap.ContainsKey($prefix)) { $unmappedPrefixes += $prefix; $evidence = 'UNMAPPED PREFIX: add to sourceMap in Build-ControlledArtifacts.ps1' }
        elseif ($sourceMap[$prefix] -like 'Functional specification*') { $evidence = $sourceMap[$prefix] }
        else { $evidence = 'Functional specification §36: ' + $sourceMap[$prefix] }
        $runtime = if ($classification -match 'NOT APPLICABLE') { 'Assumed a deployed legacy instance; none exists' }
                   elseif ($classification -match 'METADATA-DEPENDENT') { 'Schema contract present; configured instances are authored in the rebuild (D-015)' }
                   elseif ($classification -match 'PHYSICAL-DDL-VERIFY') { 'Physical schema decided by the metadata-store design (D-013)' }
                   elseif ($classification -match 'RUNTIME-VERIFY|BUILD-UNVERIFIED|DOCUMENT CONFLICT') { 'Source-only evidence; resolved by reading or a recorded decision (Gate B)' }
                   else { 'Source evidence only; no deployed instance exists' }
        # "(D-NNN)" is a pending decision; "(D-NNN decided)" records that the register row is decided.
        $decisionRef = if ($classification -match '\((D-\d{3})(?: decided)?\)') { $Matches[1] } else { '' }
        $decisionRecorded = $classification -match '\(D-\d{3} decided\)'
        $status = if ($classification -match 'NOT APPLICABLE') { 'Not applicable; no deployed legacy instance' }
                  elseif ($classification -match 'REPLATFORM DECISION') { if ($decisionRecorded) { "Decision $decisionRef recorded; test not implemented" } elseif ($decisionRef) { "Decision $decisionRef pending; test not implemented" } else { 'Replatform decision pending; test not implemented' } }
                  elseif ($classification -match 'METADATA-DEPENDENT|PHYSICAL-DDL-VERIFY|RUNTIME-VERIFY|BUILD-UNVERIFIED|DOCUMENT CONFLICT') { 'Resolution by decision pending; test not implemented' }
                  else { 'Source-specified; test not implemented' }
        $phase = if ($prefix -in $gateCitedPrefixes) { Get-GatePhase $id } else { Get-TargetPhase $prefix }
        $rows += [pscustomobject]@{Id=$id;Spec=$location;Line=$lineNumber;Classification=$classification;Source=$evidence;Runtime=$runtime;Test="AT-$id";Phase=$phase;Status=$status}
    }
    elseif ($line -match '^\|\s*(NFR-[A-Z0-9-]+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$') {
        $notApplicable = $Matches[2] -like '*NOT APPLICABLE*'
        $nfrPhase = if ($notApplicable) { 'None; not applicable' } else { Get-GatePhase $Matches[1] }
        $rows += [pscustomobject]@{Id=$Matches[1];Spec=$location;Line=$lineNumber;Classification='Non-functional acceptance floor: ' + $Matches[2].Trim();Source='Functional specification §44; verification: ' + $Matches[4].Trim();Runtime='No production calibration exists; provisional floor stands until a recorded decision';Test="AT-$($Matches[1])";Phase=$nfrPhase;Status=$(if ($notApplicable) { 'Not applicable; no legacy consumer exists' } else { 'Provisional floor; test not implemented' })}
    }
    elseif ($line -match '^\|\s*(DEF-\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$') {
        $id = $Matches[1]; $decision = $Matches[4].Trim(); $approvers = $Matches[5].Trim(); $date = $Matches[6].Trim()
        $status = if ($decision -eq '' -or $decision -eq 'Pending') { 'Product disposition and test pending' } else { "Disposition $decision approved $date by $approvers; test pending" }
        $rows += [pscustomobject]@{Id=$id;Spec=$location;Line=$lineNumber;Classification="Legacy defect; disposition: $decision";Source='Functional specification §31 plus the relevant §36 source area';Runtime='No deployed reliance exists; disposition is a product decision under D-011';Test="AT-$id";Phase='Phase 1 disposition under D-011; affected build phase';Status=$status}
    }
}

$lineNumber = 0; $section = ''
foreach ($line in Get-Content -LiteralPath $DesignPath) {
    $lineNumber++
    if ($line -match '^## (\d+\. .+)$') { $section = $Matches[1]; continue }
    if ($line -match '^\|\s*(WDES-\d+)\s*\|') {
        $rows += [pscustomobject]@{Id=$Matches[1];Spec="Design $section";Line=$lineNumber;Classification='Design verification requirement';Source='Modern web system design §33; satisfies lines cite FR/NFR IDs';Runtime='Required modern-platform verification; implementation evidence pending';Test="AT-$($Matches[1])";Phase='Phase 2 contracts; Phase 3 first slice; Phase 4 expansion; applicable gates C–F';Status='Design verification pending'}
    }
}

# ---------------------------------------------------------- write matrix
$counts = 'FR','NFR','DEF','WDES' | ForEach-Object { '{0}: {1}' -f $_, @($rows | Where-Object Id -like "$_-*").Count }
$traceBlock = @(
    '<!-- BEGIN GENERATED TRACEABILITY -->',
    ('**Rows:** ' + ($counts -join '; ')),
    ('**Legacy manifest SHA-256:** `{0}`' -f $manifestHash),
    '',
    'Every requirement, non-functional requirement, defect, and design-verification ID has a deterministic acceptance-test ID `AT-<ID>`. A row is complete only when direct evidence and an executable test result replace its pending status. Source areas refer to the functional specification §36 index.',
    '',
    '| ID | Location | Classification/disposition | Source evidence | Metadata/runtime evidence | Acceptance test | Delivery phase | Status |',
    '|---|---|---|---|---|---|---|---|'
)
foreach ($row in $rows) {
    $location = $row.Spec
    $traceBlock += '| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} |' -f (Escape-MarkdownCell $row.Id),(Escape-MarkdownCell $location),(Escape-MarkdownCell $row.Classification),(Escape-MarkdownCell $row.Source),(Escape-MarkdownCell $row.Runtime),(Escape-MarkdownCell $row.Test),(Escape-MarkdownCell $row.Phase),(Escape-MarkdownCell $row.Status)
}
$traceBlock += '<!-- END GENERATED TRACEABILITY -->'

$sourceDates = foreach ($path in @($SpecPath, $DesignPath, $MasterPath)) {
    if ((Get-Content -LiteralPath $path -Raw) -match '(?m)^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})') { $Matches[1] }
}
if (-not $sourceDates) { throw 'No source document header states a date' }
$traceDocument = @(
    '# annper Requirements Traceability',
    '',
    ('**Date:** {0}\' -f ($sourceDates | Sort-Object | Select-Object -Last 1)),
    '**Author:** `tools/Build-ControlledArtifacts.ps1`\',
    '**Status:** Generated controlled artifact\',
    '**Scope:** Requirements-to-design traceability and acceptance-test coverage',
    '',
    'This file is generated by `tools/Build-ControlledArtifacts.ps1`. Do not edit it by hand.',
    'Authority and approvals are maintained in [document control](annper-document-control.md).',
    ''
) + $traceBlock

Set-Content -LiteralPath $TraceabilityPath -Value ($traceDocument -join "`n") -Encoding utf8 -NoNewline

if ($unmappedPrefixes.Count -gt 0) { throw ('Unmapped requirement prefixes: ' + (($unmappedPrefixes | Sort-Object -Unique) -join ', ')) }

[pscustomobject]@{
    BaselineRegenerated = $baselineRegenerated
    ManifestSHA256 = $manifestHash
    Rows = $rows.Count
    Counts = ($counts -join '; ')
}
