param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$LegacySourceRoot = $env:LEGACY_SOURCE_ROOT
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath
if ([string]::IsNullOrWhiteSpace($LegacySourceRoot)) {
    $LegacySourceRoot = '\\ds423\shared\Documents\Workfiles\Visual Studio Projects\VB6\GDFramework'
}
$LegacySourceRoot = (Resolve-Path -LiteralPath $LegacySourceRoot).ProviderPath
$LegacyDocsRoot = Join-Path $LegacySourceRoot 'Docs'
$DocsRoot = Join-Path $ProjectRoot 'docs'
$SpecPath = Join-Path $DocsRoot 'GDFramework Functional Specification.md'
$TracePath = Join-Path $DocsRoot 'REQUIREMENTS_TRACEABILITY.md'
$errors = @()

$markdownFiles = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Filter '*.md'
foreach ($file in $markdownFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    $inTable = $false
    $expectedPipes = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\|') {
            $pipeCount = ([regex]::Matches($lines[$i], '(?<!\\)\|')).Count
            if (-not $inTable) { $inTable = $true; $expectedPipes = $pipeCount }
            if ($pipeCount -ne $expectedPipes) {
                $errors += "$($file.FullName):$($i + 1) table has $pipeCount pipes; expected $expectedPipes"
            }
        } else {
            $inTable = $false
            $expectedPipes = 0
        }
    }

    $raw = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($match in [regex]::Matches($raw, '\[[^\]]+\]\(([^)]+)\)')) {
        $link = $match.Groups[1].Value
        if ($link -notmatch '^(https?://|mailto:|#)') {
            $pathPart = [uri]::UnescapeDataString(($link -replace '#.*$', ''))
            if ($pathPart) {
                $target = Join-Path $file.DirectoryName $pathPart
                if (-not (Test-Path -LiteralPath $target)) {
                    $errors += "$($file.FullName) has missing local link: $link"
                }
            }
        }
    }
}

$controlledFiles = $markdownFiles | Where-Object { $_.FullName -notlike '*\docs\archive\*' }
$machinePaths = Select-String -Path $controlledFiles.FullName -Pattern 'C:\\Users\\|(?<![A-Za-z])W:\\' -AllMatches
foreach ($match in $machinePaths) {
    $errors += "$($match.Path):$($match.LineNumber) contains a machine-specific path"
}

$specRaw = Get-Content -LiteralPath $SpecPath -Raw
$requirementIds = [regex]::Matches($specRaw, '(?m)^\|\s*(FR-[A-Z0-9-]+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$defectIds = [regex]::Matches($specRaw, '(?m)^\|\s*(DEF-\d+)\s*\|') | ForEach-Object { $_.Groups[1].Value }
$allSpecIds = @($requirementIds) + @($defectIds)
foreach ($duplicate in $allSpecIds | Group-Object | Where-Object Count -gt 1) {
    $errors += "Duplicate specification ID: $($duplicate.Name)"
}

$traceRaw = Get-Content -LiteralPath $TracePath -Raw
$traceIds = [regex]::Matches($traceRaw, '(?m)^\|\s*((?:FR-[A-Z0-9-]+)|(?:DEF-\d+))\s*\|') | ForEach-Object { $_.Groups[1].Value }
$missingTrace = $allSpecIds | Where-Object { $_ -notin $traceIds }
$extraTrace = $traceIds | Where-Object { $_ -notin $allSpecIds }
foreach ($id in $missingTrace) { $errors += "Specification ID missing from traceability: $id" }
foreach ($id in $extraTrace) { $errors += "Traceability ID absent from specification: $id" }
foreach ($duplicate in $traceIds | Group-Object | Where-Object Count -gt 1) {
    $errors += "Duplicate traceability ID: $($duplicate.Name)"
}

$checksumPath = Join-Path $ProjectRoot 'baseline\legacy-source.sha256'
$identityPath = Join-Path $ProjectRoot 'baseline\legacy-source-manifest.sha256'
$expectedIdentity = ((Get-Content -LiteralPath $identityPath -Raw).Trim() -split '\s+')[0]
$actualIdentity = (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualIdentity -ne $expectedIdentity) {
    $errors += "Checksum manifest identity mismatch: expected $expectedIdentity; actual $actualIdentity"
}

$exactReferenceCount = 0
$invalidReferenceCount = 0
$sourceMatches = [regex]::Matches($specRaw, '(?<path>\.\./(?:\.\./)?[^`,;]+?\.(?:frm|bas|cls|ctl|pag|vbp|ini|sql|doc|xls|ppt))(?::(?<start>\d+)(?:-(?<end>\d+))?)?')
foreach ($match in $sourceMatches) {
    $relative = $match.Groups['path'].Value
    if ($relative -match '[*?]') { continue }
    $exactReferenceCount++
    $fullPath = [IO.Path]::GetFullPath((Join-Path $LegacyDocsRoot $relative))
    if (-not (Test-Path -LiteralPath $fullPath)) {
        $errors += "Missing exact source reference: $relative"
        $invalidReferenceCount++
        continue
    }
    if ($match.Groups['start'].Success) {
        $lineCount = (Get-Content -LiteralPath $fullPath).Count
        $end = if ($match.Groups['end'].Success) { [int]$match.Groups['end'].Value } else { [int]$match.Groups['start'].Value }
        if ($end -gt $lineCount) {
            $errors += "Out-of-range source reference: $($match.Value); file has $lineCount lines"
            $invalidReferenceCount++
        }
    }
}

$result = [pscustomobject]@{
    MarkdownFiles = $markdownFiles.Count
    FunctionalRequirements = $requirementIds.Count
    LegacyDefects = $defectIds.Count
    TraceabilityRows = $traceIds.Count
    ExactSourceReferences = $exactReferenceCount
    InvalidSourceReferences = $invalidReferenceCount
    Errors = $errors.Count
    ManifestSHA256 = $actualIdentity
}

$result
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}
