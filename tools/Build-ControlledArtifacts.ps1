param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$LegacySourceRoot = $env:LEGACY_SOURCE_ROOT
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($LegacySourceRoot)) {
    $LegacySourceRoot = '\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework'
}

$LegacySourceRoot = (Resolve-Path -LiteralPath $LegacySourceRoot).ProviderPath
$VbRoot = Split-Path $LegacySourceRoot -Parent
$GuiRoot = Join-Path $VbRoot 'GenData\AppGUI'
$GuiRoot = (Resolve-Path -LiteralPath $GuiRoot).ProviderPath
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
$BaselineRoot = Join-Path $ProjectRoot 'baseline'
$DocsRoot = Join-Path $ProjectRoot 'docs'
$SpecPath = Join-Path $DocsRoot 'GDFramework Functional Specification.md'

foreach ($required in @($BaselineRoot, $DocsRoot, $SpecPath)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required path is missing: $required"
    }
}

function Get-RelativePortablePath {
    param([string]$BasePath, [string]$FullPath)
    [IO.Path]::GetRelativePath($BasePath, $FullPath).Replace('\', '/')
}

$inventory = @()
foreach ($scope in @(
    @{ Name = 'GDFramework'; Root = $LegacySourceRoot },
    @{ Name = 'GenData/AppGUI'; Root = $GuiRoot }
)) {
    foreach ($file in Get-ChildItem -LiteralPath $scope.Root -Recurse -File | Sort-Object FullName) {
        $relative = Get-RelativePortablePath -BasePath $scope.Root -FullPath $file.FullName
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $inventory += [pscustomobject]@{
            Scope = $scope.Name
            RelativePath = $relative
            Extension = $file.Extension
            Length = $file.Length
            LastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('o')
            SHA256 = $hash
        }
    }
}

$inventoryPath = Join-Path $BaselineRoot 'legacy-file-inventory.csv'
$checksumPath = Join-Path $BaselineRoot 'legacy-source.sha256'
$manifestIdentityPath = Join-Path $BaselineRoot 'legacy-source-manifest.sha256'

$inventory | Export-Csv -LiteralPath $inventoryPath -NoTypeInformation -Encoding utf8
$checksumLines = $inventory | ForEach-Object { '{0} *{1}/{2}' -f $_.SHA256, $_.Scope, $_.RelativePath }
Set-Content -LiteralPath $checksumPath -Value $checksumLines -Encoding utf8
$manifestHash = (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $manifestIdentityPath -Value "$manifestHash *legacy-source.sha256" -Encoding utf8

$sourceMap = @{
    'START'='Functional specification source index: Startup and option constants; Main initialization'
    'AUTH'='Functional specification source index: Client/server startup and security; Display configuration/security assembly'
    'SHELL'='Functional specification source index: Shell layout; Main initialization; Global toolbar/export/shutdown'
    'NAV'='Functional specification source index: Menu loading; Navigation selection and screen creation'
    'WIN'='Functional specification source index: Docking/tabs/resize; Modal screen contract'
    'FORM'='Functional specification source index: Screen configuration lifecycle; Generic screen states/enums'
    'VIEW'='Functional specification source index: Generic screen states/enums; Field and master-detail views'
    'FIELD'='Functional specification source index: Grid metadata construction; Dynamic parameters and criteria'
    'TBR'='Functional specification source index: Generic toolbar command routing; Toolbar generation and view selection'
    'DC'='Functional specification source index: Server initialization and dataset catalog; Server data facade'
    'PARAM'='Functional specification source index: Dynamic parameters and criteria; Server initialization and dataset catalog'
    'JOIN'='Functional specification source index: Runtime dataset joining'
    'FILTER'='Functional specification source index: Filtering/search; Grid context/customization'
    'SEARCH'='Functional specification source index: Filtering/search'
    'CRUD'='Functional specification source index: CRUD and refresh; DML generation/execution'
    'CACHE'='Functional specification source index: Connection/query/cache/transactions'
    'REFRESH'='Functional specification source index: CRUD and refresh; Client messaging/polling'
    'GRID'='Functional specification source index: Grid metadata construction; Grid context/customization'
    'RPT'='Functional specification source index: Report/cross-tab processing'
    'XL'='Functional specification source index: Global toolbar/export/shutdown; Report/cross-tab processing'
    'PRINT'='Functional specification source index: Report/cross-tab processing'
    'CHART'='Functional specification §§13.7, 21 and component catalogue'
    'MSG'='Functional specification source index: Message presentation and application switching'
    'SYSMSG'='Functional specification source index: Client messaging/polling'
    'LOG'='Functional specification §§22, 40 and client/server logging sources'
    'DIAG'='Functional specification §§22, 40 and system-information sources'
    'EXT'='Functional specification source index: Extension interfaces'
    'CONN'='Functional specification source index: Connection/query/cache/transactions'
    'CTL'='Functional specification source index: Complete custom-control API and UI integration'
    'AGG'='Functional specification source index: Aggregation engine'
    'LIMIT'='Functional specification source index: Limit-processing server'
    'META'='Functional specification §28 plus historical metadata documents; deployed rows pending'
    'PROJ'='Functional specification source index: Project membership/build variants'
    'DEP'='Functional specification §38 and project references'
    'CMD'='Functional specification source index: Command parser and option constants'
    'STATE'='Functional specification source index: Support collections/value objects'
    'BUILD'='Functional specification §§37, 42 and binary/type-library lineage evidence'
    'PLM'='Functional specification source index: Historical PLM scope and gaps'
}

function Get-RequirementPrefix {
    param([string]$Id)
    if ($Id -match '^FR-([A-Z0-9]+)-') { return $Matches[1] }
    return 'DEF'
}

function Get-TargetPhase {
    param([string]$Prefix)
    if ($Prefix -in @('PROJ','DEP','BUILD')) { return 'Phase 0' }
    if ($Prefix -in @('CTL','TBR','NAV','WIN','FIELD','VIEW','SHELL','FORM','GRID','CHART','PRINT','XL')) { return 'Phase 1 characterization; Phase 6 implementation' }
    if ($Prefix -in @('AGG','LIMIT','EXT','CONN','DC','PARAM','JOIN','CRUD','CACHE','REFRESH','MSG','SYSMSG','LOG','DIAG','RPT')) { return 'Phase 1 characterization; Phase 3/4 implementation' }
    if ($Prefix -eq 'META') { return 'Phase 1 metadata discovery' }
    if ($Prefix -eq 'CMD') { return 'Phase 1 characterization; Phase 2/4 implementation' }
    return 'Phase 1 characterization; implementation phase assigned with first consumer'
}

$rows = @()
$defects = @()
$section = ''
$subsection = ''
$lineNumber = 0
foreach ($line in Get-Content -LiteralPath $SpecPath) {
    $lineNumber++
    if ($line -match '^## (\d+\. .+)$') { $section = $Matches[1]; $subsection = ''; continue }
    if ($line -match '^### (\d+\.\d+ .+)$') { $subsection = $Matches[1]; continue }
    if ($line -match '^\|\s*(FR-[A-Z0-9-]+)\s*\|.*\|\s*([^|]+?)\s*\|\s*$') {
        $id = $Matches[1]
        $classification = $Matches[2].Trim()
        $prefix = Get-RequirementPrefix $id
        $evidence = if ($sourceMap.ContainsKey($prefix)) { $sourceMap[$prefix] } else { 'Functional specification source index §36; mapping requires refinement' }
        $runtime = if ($classification -match 'METADATA-DEPENDENT') {
            'Required: deployed metadata/database catalogue row pending'
        } elseif ($classification -match 'RUNTIME-VERIFY|BUILD-UNVERIFIED|DOCUMENT CONFLICT') {
            'Required: runtime/provenance evidence pending'
        } else {
            'Framework source evidence present; deployed-use confirmation applies where relevant'
        }
        $status = if ($classification -match 'METADATA-DEPENDENT|RUNTIME-VERIFY|BUILD-UNVERIFIED|DOCUMENT CONFLICT') { 'Discovery evidence pending; test not implemented' } else { 'Source-specified; test not implemented' }
        $rows += [pscustomobject]@{Id=$id;Spec=if($subsection){$subsection}else{$section};Line=$lineNumber;Classification=$classification;Source=$evidence;Runtime=$runtime;Test="AT-$id";Phase=Get-TargetPhase $prefix;Status=$status}
    } elseif ($line -match '^\|\s*(DEF-\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$') {
        $id = $Matches[1]
        $issue = $Matches[2].Trim()
        $recommendation = $Matches[3].Trim()
        $defects += [pscustomobject]@{Id=$id;Issue=$issue;Recommendation=$recommendation;Line=$lineNumber}
        $rows += [pscustomobject]@{Id=$id;Spec=$section;Line=$lineNumber;Classification='Legacy defect; disposition pending';Source='Functional specification §31 plus the relevant §36 source area';Runtime='Production reliance/behavior evidence pending where identified';Test="AT-$id";Phase='Phase 1 disposition; affected implementation phase';Status='Product disposition and test pending'}
    }
}

function Escape-MarkdownCell {
    param([string]$Value)
    if ($null -eq $Value) { return '' }
    return $Value.Replace('|','\|').Replace("`r",' ').Replace("`n",' ')
}

$tracePath = Join-Path $DocsRoot 'REQUIREMENTS_TRACEABILITY.md'
$trace = @(
    '# GDFramework Requirements Traceability Matrix',
    '',
    '**Status:** Generated controlled inventory; evidence and tests progressively completed  ',
    "**Generated:** $((Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK'))  ",
    "**Functional requirements:** $(($rows | Where-Object Id -like 'FR-*').Count)  ",
    "**Legacy defects:** $(($rows | Where-Object Id -like 'DEF-*').Count)  ",
    ('**Legacy manifest SHA-256:** `{0}`' -f $manifestHash),
    '',
    'Every functional and defect ID has a deterministic acceptance-test ID. A row is not complete until its direct source/metadata/runtime evidence and executable test result replace any pending status. Source-area mappings refer to the exact paths/ranges in functional specification §36.',
    '',
    '| ID | Specification location | Classification/disposition | Source evidence | Metadata/runtime evidence | Acceptance test | Delivery phase | Status |',
    '|---|---|---|---|---|---|---|---|'
)
foreach ($row in $rows) {
    $location = '{0} (source line {1})' -f $row.Spec, $row.Line
    $trace += '| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} |' -f (Escape-MarkdownCell $row.Id),(Escape-MarkdownCell $location),(Escape-MarkdownCell $row.Classification),(Escape-MarkdownCell $row.Source),(Escape-MarkdownCell $row.Runtime),(Escape-MarkdownCell $row.Test),(Escape-MarkdownCell $row.Phase),(Escape-MarkdownCell $row.Status)
}
Set-Content -LiteralPath $tracePath -Value $trace -Encoding utf8

$defectPath = Join-Path $DocsRoot 'DEFECT_DISPOSITION.md'
$defectDoc = @(
    '# GDFramework Legacy Defect Disposition Register',
    '',
    '**Status:** Generated inventory; product dispositions pending  ',
    "**Generated:** $((Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK'))",
    '',
    'Allowed decisions are `Preserve`, `Fix`, or `Retire`. Preserve requires an explicit business reliance, security approval, compatibility scope, and expiry/retirement plan. The recommendation is evidence, not an approved decision.',
    '',
    '| ID | Legacy issue | Recommended treatment | Decision | Owner | Evidence/test |',
    '|---|---|---|---|---|---|'
)
foreach ($defect in $defects) {
    $defectDoc += '| {0} | {1} | {2} | Pending | Product/domain owner | Functional spec line {3}; AT-{0} pending |' -f (Escape-MarkdownCell $defect.Id),(Escape-MarkdownCell $defect.Issue),(Escape-MarkdownCell $defect.Recommendation),$defect.Line
}
Set-Content -LiteralPath $defectPath -Value $defectDoc -Encoding utf8

[pscustomobject]@{
    LegacyRoot = $LegacySourceRoot
    GuiRoot = $GuiRoot
    FilesHashed = $inventory.Count
    ManifestSHA256 = $manifestHash
    Requirements = ($rows | Where-Object Id -like 'FR-*').Count
    Defects = $defects.Count
    TraceabilityPath = $tracePath
    DefectPath = $defectPath
}
