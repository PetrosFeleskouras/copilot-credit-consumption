param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUnmanagedPackage,

    [Parameter(Mandatory = $true)]
    [string]$BaseManagedPackage,

    [string]$OutputRoot = (Join-Path $PSScriptRoot 'dist')
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$solutionVersion = '2.0.0.0'
$flowSourcePath = Join-Path $PSScriptRoot 'src\Workflows\CopilotCreditConsumptionEndToEnd-3C9D1E202B3C4D5E9F6A7B8C9D0E1F2A.json'

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

function Build-FullPackage {
    param(
        [string]$BasePackage,
        [string]$OutputName
    )

    $basePackagePath = [System.IO.Path]::GetFullPath($BasePackage)
    if (-not [System.IO.File]::Exists($basePackagePath)) {
        throw "Base package not found: $basePackagePath"
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "copilot-credit-v2-$([guid]::NewGuid())"
    [System.IO.Directory]::CreateDirectory($tempRoot) | Out-Null

    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($basePackagePath, $tempRoot)

        $solutionPath = Join-Path $tempRoot 'solution.xml'
        $customizationsPath = Join-Path $tempRoot 'customizations.xml'
        [xml]$solution = [System.IO.File]::ReadAllText($solutionPath)
        [xml]$customizations = [System.IO.File]::ReadAllText($customizationsPath)

        $solution.ImportExportXml.SolutionManifest.Version = $solutionVersion
        $solution.ImportExportXml.SolutionManifest.Descriptions.Description.description =
            'Version 2 uses the Power Platform API for capacity and detailed Copilot credit consumption, with stable large-page reads and chunked Dataverse writes.'
        Save-XmlDocument -Document $solution -Path $solutionPath

        $legacyReference = @(
            @($customizations.ImportExportXml.connectionreferences.connectionreference) |
                Where-Object { $_.connectionreferencelogicalname -eq 'ccsync_webref' }
        )
        if ($legacyReference.Count -ne 1) {
            throw "Expected one ccsync_webref connection reference in $basePackagePath, found $($legacyReference.Count)."
        }
        $legacyReference[0].ParentNode.RemoveChild($legacyReference[0]) | Out-Null
        Save-XmlDocument -Document $customizations -Path $customizationsPath

        $workflowNode = @($customizations.ImportExportXml.Workflows.Workflow) |
            Where-Object { $_.WorkflowId -eq '{3c9d1e20-2b3c-4d5e-9f6a-7b8c9d0e1f2a}' }
        if ($null -eq $workflowNode) {
            throw "Target workflow metadata not found in $basePackagePath."
        }
        $workflowRelativePath = ([string]$workflowNode.JsonFileName).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $workflowOutputPath = Join-Path $tempRoot $workflowRelativePath

        $flow = [System.IO.File]::ReadAllText($flowSourcePath) | ConvertFrom-Json -Depth 100
        if ($null -eq $flow.properties.PSObject.Properties['templateName']) {
            $flow.properties | Add-Member -NotePropertyName templateName -NotePropertyValue $null
        }
        $flowJson = $flow | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText($workflowOutputPath, $flowJson + "`r`n", $utf8NoBom)

        $outputPath = Join-Path ([System.IO.Path]::GetFullPath($OutputRoot)) $OutputName
        if ([System.IO.File]::Exists($outputPath)) {
            [System.IO.File]::Delete($outputPath)
        }
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $tempRoot,
            $outputPath,
            [System.IO.Compression.CompressionLevel]::Optimal,
            $false
        )

        return [pscustomobject]@{
            packageType = if ([int]$solution.ImportExportXml.SolutionManifest.Managed -eq 1) { 'Managed' } else { 'Unmanaged' }
            version = $solutionVersion
            package = $outputPath
            workflow = $workflowRelativePath
        }
    }
    finally {
        if ([System.IO.Directory]::Exists($tempRoot)) {
            [System.IO.Directory]::Delete($tempRoot, $true)
        }
    }
}

& (Join-Path $PSScriptRoot 'build-v2.ps1') | Out-Null
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetFullPath($OutputRoot)) | Out-Null

@(
    Build-FullPackage -BasePackage $BaseUnmanagedPackage -OutputName 'CopilotCreditConsumption_v2.zip'
    Build-FullPackage -BasePackage $BaseManagedPackage -OutputName 'CopilotCreditConsumption_v2_managed.zip'
) | Format-Table -AutoSize