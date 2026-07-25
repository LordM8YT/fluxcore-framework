# Update GitBook markdown files - replace varde with nord
$files = Get-ChildItem -Path "." -Recurse -Include "*.md"

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $originalContent = $content
    
    # Perform replacements
    $content = $content -replace 'varde_framework\.gitbook\.io/varde', 'nord-framework.gitbook.io/nord'
    $content = $content -replace '\[varde\]', '[nord]'
    $content = $content -replace 'varde_([a-z_])', 'nord_$1'
    $content = $content -replace 'Varde Framework', 'Nord Framework'
    $content = $content -replace 'Varde', 'Nord'
    $content = $content -replace 'ensure varde', 'ensure nord'
    $content = $content -replace 'setr varde', 'setr nord'
    $content = $content -replace 'set varde', 'set nord'
    $content = $content -replace 'data/varde', 'data/nord'
    
    # Write back if changed
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "All markdown files updated!"
