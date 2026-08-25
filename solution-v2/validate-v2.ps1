param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUnmanagedPackage,

    [Parameter(Mandatory = $true)]
    [string]$BaseManagedPackage,

    [string]$UnmanagedPackage = (Join-Path $PSScriptRoot 'dist\CopilotCreditConsumption_v2.zip'),
    [string]$ManagedPackage = (Join-Path $PSScriptRoot 'dist\CopilotCreditConsumption_v2_managed.zip')
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        $failures.Add($Message)
    }
}

function Get-EntryBytes {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$Name
    )

    $entry = $Archive.GetEntry($Name)
    if ($null -eq $entry) {
        throw "Missing archive entry: $Name"
    }
    $stream = $entry.Open()
    $memory = [System.IO.MemoryStream]::new()
    try {
        $stream.CopyTo($memory)
        return $memory.ToArray()
    }
    finally {
        $memory.Dispose()
        $stream.Dispose()
    }
}

function Get-EntryText {
    param(
        [System.IO.Compression.ZipArchive]$Archive,
        [string]$Name
    )

    return [System.Text.Encoding]::UTF8.GetString((Get-EntryBytes -Archive $Archive -Name $Name))
}

function Get-ByteHash {
    param([byte[]]$Bytes)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return [Convert]::ToHexString($sha256.ComputeHash($Bytes))
    }
    finally {
        $sha256.Dispose()
    }
}

function Test-Package {
    param(
        [string]$PackagePath,
        [string]$BasePackagePath,
        [int]$ExpectedManaged,
        [string]$Label
    )

    $packageFullPath = [System.IO.Path]::GetFullPath($PackagePath)
    $baseFullPath = [System.IO.Path]::GetFullPath($BasePackagePath)
    Assert-True -Condition ([System.IO.File]::Exists($packageFullPath)) -Message "$Label package is missing: $packageFullPath"
    Assert-True -Condition ([System.IO.File]::Exists($baseFullPath)) -Message "$Label baseline is missing: $baseFullPath"
    if (-not [System.IO.File]::Exists($packageFullPath) -or -not [System.IO.File]::Exists($baseFullPath)) {
        return $null
    }

    $packageStream = [System.IO.File]::OpenRead($packageFullPath)
    $baseStream = [System.IO.File]::OpenRead($baseFullPath)
    $packageArchive = [System.IO.Compression.ZipArchive]::new($packageStream, [System.IO.Compression.ZipArchiveMode]::Read)
    $baseArchive = [System.IO.Compression.ZipArchive]::new($baseStream, [System.IO.Compression.ZipArchiveMode]::Read)

    try {
        $solutionText = Get-EntryText -Archive $packageArchive -Name 'solution.xml'
        $customizationsText = Get-EntryText -Archive $packageArchive -Name 'customizations.xml'
        [xml]$solution = $solutionText
        [xml]$customizations = $customizationsText

        $workflowNode = @($customizations.ImportExportXml.Workflows.Workflow) |
            Where-Object { $_.WorkflowId -eq '{3c9d1e20-2b3c-4d5e-9f6a-7b8c9d0e1f2a}' }
        Assert-True -Condition ($null -ne $workflowNode) -Message "$Label target workflow metadata is missing."
        if ($null -eq $workflowNode) {
            return $null
        }

        $workflowName = ([string]$workflowNode.JsonFileName).TrimStart('/')
        $workflowText = Get-EntryText -Archive $packageArchive -Name $workflowName
        $flow = $workflowText | ConvertFrom-Json -Depth 100
        $allText = $solutionText + $customizationsText + $workflowText

        $connectionNames = @($customizations.ImportExportXml.connectionreferences.connectionreference.connectionreferencelogicalname | Sort-Object)
        $expectedConnections = @('ccsync_bapref', 'ccsync_dvhttpref', 'ccsync_dvref')
        Assert-True -Condition ($connectionNames.Count -eq 3) -Message "$Label expected 3 connection references, found $($connectionNames.Count)."
        Assert-True -Condition (($connectionNames -join '|') -eq ($expectedConnections -join '|')) -Message "$Label connection references differ: $($connectionNames -join ', ')."
        Assert-True -Condition (-not $allText.Contains('ccsync_webref')) -Message "$Label still contains ccsync_webref."
        Assert-True -Condition (-not $allText.Contains('licensing.powerplatform.microsoft.com')) -Message "$Label still contains the legacy licensing host."

        Assert-True -Condition ($solution.ImportExportXml.SolutionManifest.UniqueName -eq 'CopilotCreditConsumption') -Message "$Label solution unique name changed."
        Assert-True -Condition ($solution.ImportExportXml.SolutionManifest.Version -eq '2.0.0.0') -Message "$Label solution version is not 2.0.0.0."
        Assert-True -Condition ([int]$solution.ImportExportXml.SolutionManifest.Managed -eq $ExpectedManaged) -Message "$Label managed flag is incorrect."
        Assert-True -Condition ($flow.schemaVersion -eq '1.0.0.0') -Message "$Label workflow schemaVersion is incorrect."

        $actions = $flow.properties.definition.actions
        $capacity = $actions.Process.actions.Get_Capacity_MCS
        $untilDay = $actions.Process.actions.Insert_Days.actions.Apply_to_each_Day.actions.Until_Day.actions
        $pageDay = $untilDay.Page_Day
        $objects = $untilDay.Objs_Day.inputs.select
        $writeIf = $untilDay.If_Rows_Day.actions
        $writeLoop = $writeIf.Apply_to_each_Write_Chunk

        Assert-True -Condition ($capacity.inputs.host.connectionName -eq 'shared_webcontents_1') -Message "$Label capacity action does not use ccsync_bapref."
        Assert-True -Condition ($capacity.inputs.parameters.'request/url' -eq 'https://api.powerplatform.com/licensing/entitlements/MCSMessages?api-version=2024-10-01') -Message "$Label capacity URL is incorrect."
        Assert-True -Condition ($pageDay.inputs.host.connectionName -eq 'shared_webcontents_1') -Message "$Label detail action does not use ccsync_bapref."
        Assert-True -Condition ($pageDay.inputs.parameters.'request/url'.Contains('https://api.powerplatform.com/licensing/entitlements/MCSMessages/resources')) -Message "$Label detail URL host/path is incorrect."
        Assert-True -Condition ($pageDay.inputs.parameters.'request/url'.Contains('pageSize=5000')) -Message "$Label detail URL does not request pageSize=5000."
        Assert-True -Condition ($pageDay.inputs.parameters.'request/url'.Contains('api-version=2024-10-01')) -Message "$Label detail URL lacks api-version=2024-10-01."
        Assert-True -Condition ($pageDay.inputs.parameters.'request/url'.Contains('continuationtoken=')) -Message "$Label continuation paging was removed."
        Assert-True -Condition ($null -ne $untilDay.Filter_New -and $null -ne $untilDay.Keys_New) -Message "$Label cross-page deduplication actions are missing."
        Assert-True -Condition ($objects.cat_llmmodel -eq "@item()?['metadata']?['LLMModel']") -Message "$Label LLM model mapping changed."
        Assert-True -Condition ($objects.cat_channel -eq "@item()?['metadata']?['ChannelId']") -Message "$Label channel mapping changed."
        Assert-True -Condition ($objects.cat_feature -eq "@item()?['metadata']?['FeatureName']") -Message "$Label feature mapping changed."
        Assert-True -Condition ($writeIf.Compose_Write_Chunk_Indexes.inputs -eq "@range(0, int(div(add(length(body('Filter_New')), 499), 500)))") -Message "$Label chunk-count expression is incorrect."
        Assert-True -Condition ($writeLoop.actions.Compose_Chunk_Rows.inputs -eq "@take(skip(body('Filter_New'), mul(items('Apply_to_each_Write_Chunk'), 500)), 500)") -Message "$Label chunk-row expression is incorrect."
        Assert-True -Condition ([int]$writeLoop.runtimeConfiguration.concurrency.repetitions -eq 1) -Message "$Label write chunks are not sequential."

        $preservedEntries = @('[Content_Types].xml') + @($packageArchive.Entries.FullName | Where-Object { $_ -like 'CanvasApps/*' })
        foreach ($entryName in $preservedEntries) {
            $packageHash = Get-ByteHash -Bytes (Get-EntryBytes -Archive $packageArchive -Name $entryName)
            $baseHash = Get-ByteHash -Bytes (Get-EntryBytes -Archive $baseArchive -Name $entryName)
            Assert-True -Condition ($packageHash -eq $baseHash) -Message "$Label changed preserved entry $entryName."
        }

        return [pscustomobject]@{
            packageType = $Label
            entries = $packageArchive.Entries.Count
            bytes = ([System.IO.FileInfo]$packageFullPath).Length
            sha256 = (Get-FileHash -Path $packageFullPath -Algorithm SHA256).Hash
            workflowHash = Get-ByteHash -Bytes ([System.Text.Encoding]::UTF8.GetBytes($workflowText))
        }
    }
    finally {
        $baseArchive.Dispose()
        $packageArchive.Dispose()
        $baseStream.Dispose()
        $packageStream.Dispose()
    }
}

$results = @(
    Test-Package -PackagePath $UnmanagedPackage -BasePackagePath $BaseUnmanagedPackage -ExpectedManaged 0 -Label 'Unmanaged'
    Test-Package -PackagePath $ManagedPackage -BasePackagePath $BaseManagedPackage -ExpectedManaged 1 -Label 'Managed'
)

if ($results.Count -eq 2) {
    Assert-True -Condition ($results[0].workflowHash -eq $results[1].workflowHash) -Message 'Managed and unmanaged V2 workflows differ.'
}

$results | Select-Object packageType, entries, bytes, sha256 | Format-Table -AutoSize
if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'V2 package validation passed.'