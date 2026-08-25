param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..\solution-allinone\src'),
    [string]$OutputRoot = (Join-Path $PSScriptRoot 'src'),
    [string]$DistRoot = (Join-Path $PSScriptRoot 'dist')
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$workflowFileName = 'CopilotCreditConsumptionEndToEnd-3C9D1E202B3C4D5E9F6A7B8C9D0E1F2A.json'
$solutionVersion = '2.0.0.0'
$sourcePageSize = 5000
$writeChunkSize = 500

function Save-XmlDocument {
    param(
        [xml]$Document,
        [string]$Path
    )

    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = $utf8NoBom
    $settings.Indent = $true
    $settings.IndentChars = '  '
    $settings.NewLineChars = "`r`n"
    $settings.NewLineHandling = [System.Xml.NewLineHandling]::Replace

    $writer = [System.Xml.XmlWriter]::Create($Path, $settings)
    try {
        $Document.Save($writer)
    }
    finally {
        $writer.Dispose()
    }
}

$sourceRootPath = [System.IO.Path]::GetFullPath($SourceRoot)
$outputRootPath = [System.IO.Path]::GetFullPath($OutputRoot)
$distRootPath = [System.IO.Path]::GetFullPath($DistRoot)
$workflowOutputDirectory = Join-Path $outputRootPath 'Workflows'

[System.IO.Directory]::CreateDirectory($outputRootPath) | Out-Null
[System.IO.Directory]::CreateDirectory($workflowOutputDirectory) | Out-Null
[System.IO.Directory]::CreateDirectory($distRootPath) | Out-Null

[System.IO.File]::Copy(
    (Join-Path $sourceRootPath '[Content_Types].xml'),
    (Join-Path $outputRootPath '[Content_Types].xml'),
    $true
)

[xml]$solution = [System.IO.File]::ReadAllText((Join-Path $sourceRootPath 'solution.xml'))
$solution.ImportExportXml.SolutionManifest.Version = $solutionVersion
$solution.ImportExportXml.SolutionManifest.Descriptions.Description.description =
    'Version 2 uses the supported Power Platform API for capacity and detailed Copilot credit consumption, with stable large-page reads and chunked Dataverse writes.'
Save-XmlDocument -Document $solution -Path (Join-Path $outputRootPath 'solution.xml')

[xml]$customizations = [System.IO.File]::ReadAllText((Join-Path $sourceRootPath 'customizations.xml'))
$legacyReference = @(
    @($customizations.ImportExportXml.connectionreferences.connectionreference) |
        Where-Object { $_.connectionreferencelogicalname -eq 'ccsync_webref' }
)
if ($legacyReference.Count -ne 1) {
    throw "Expected one ccsync_webref connection reference, found $($legacyReference.Count)."
}
$legacyReference[0].ParentNode.RemoveChild($legacyReference[0]) | Out-Null
Save-XmlDocument -Document $customizations -Path (Join-Path $outputRootPath 'customizations.xml')

$workflowSourcePath = Join-Path (Join-Path $sourceRootPath 'Workflows') $workflowFileName
$flow = [System.IO.File]::ReadAllText($workflowSourcePath) | ConvertFrom-Json -Depth 100
$connectionReferences = $flow.properties.connectionReferences
$connectionReferences.PSObject.Properties.Remove('shared_webcontents')

$actions = $flow.properties.definition.actions
$actions.PSObject.Properties.Remove('Compose_Tenant_Id')
$actions.Compose_Batch.runAfter = [pscustomobject][ordered]@{ Compose_Org = @('Succeeded') }

$capacityAction = $actions.Process.actions.Get_Capacity_MCS
$capacityAction.inputs.host.connectionName = 'shared_webcontents_1'
$capacityAction.inputs.parameters.'request/url' =
    'https://api.powerplatform.com/licensing/entitlements/MCSMessages?api-version=2024-10-01'

$untilDayActions = $actions.Process.actions.Insert_Days.actions.Apply_to_each_Day.actions.Until_Day.actions
$pageAction = $untilDayActions.Page_Day
$pageAction.inputs.host.connectionName = 'shared_webcontents_1'
$pageAction.inputs.parameters.'request/url' =
    "@{concat('https://api.powerplatform.com/licensing/entitlements/MCSMessages/resources?fromDate=', items('Apply_to_each_Day'), '&toDate=', items('Apply_to_each_Day'), '&includeFields=users%2Ctags%2CasOfDate&pageSize=$sourcePageSize&continuationtoken=', variables('varContDay'), '&api-version=2024-10-01')}"

$untilDayActions.Objs_Day.inputs.select.cat_sourcefilename =
    'api.powerplatform.com/2024-10-01/MCSMessages/resources/1d'

$ifRows = $untilDayActions.If_Rows_Day
$partsAction = $ifRows.actions.Parts_Day
$bodyAction = $ifRows.actions.Body_Day
$postAction = $ifRows.actions.Post_Day

$partsAction.inputs.from = "@outputs('Compose_Chunk_Rows')"
$partsAction.runAfter = [pscustomobject][ordered]@{ Compose_Chunk_Rows = @('Succeeded') }

$chunkActions = [ordered]@{
    Compose_Chunk_Rows = [ordered]@{
        type = 'Compose'
        inputs = "@take(skip(body('Filter_New'), mul(items('Apply_to_each_Write_Chunk'), $writeChunkSize)), $writeChunkSize)"
        runAfter = [ordered]@{}
    }
    Parts_Day = $partsAction
    Body_Day = $bodyAction
    Post_Day = $postAction
}

$ifRows.actions = [pscustomobject][ordered]@{
    Compose_Write_Chunk_Indexes = [ordered]@{
        type = 'Compose'
        inputs = "@range(0, int(div(add(length(body('Filter_New')), $($writeChunkSize - 1)), $writeChunkSize)))"
        runAfter = [ordered]@{}
    }
    Apply_to_each_Write_Chunk = [ordered]@{
        type = 'Foreach'
        foreach = "@outputs('Compose_Write_Chunk_Indexes')"
        runtimeConfiguration = [ordered]@{
            concurrency = [ordered]@{ repetitions = 1 }
        }
        runAfter = [ordered]@{ Compose_Write_Chunk_Indexes = @('Succeeded') }
        actions = $chunkActions
    }
}

$actions.Set_Status_Success.inputs.parameters.'item/cat_lastsyncmessage' =
    'Agent sync OK (Power Platform API V2, 7-day overlap)'

$workflowOutputPath = Join-Path $workflowOutputDirectory $workflowFileName
$workflowJson = $flow | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($workflowOutputPath, $workflowJson + "`r`n", $utf8NoBom)

$zipPath = Join-Path $distRootPath "CopilotCreditConsumption_$($solutionVersion.Replace('.', '_')).zip"
if ([System.IO.File]::Exists($zipPath)) {
    [System.IO.File]::Delete($zipPath)
}
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $outputRootPath,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

[pscustomobject]@{
    version = $solutionVersion
    sourcePageSize = $sourcePageSize
    writeChunkSize = $writeChunkSize
    source = $outputRootPath
    package = $zipPath
} | Format-List