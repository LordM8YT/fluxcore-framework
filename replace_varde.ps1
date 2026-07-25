# Bulk replace varde with nord in all resource files
$files = Get-ChildItem -Path "resources" -Recurse -Include "*.lua", "*.js", "*.json" | Where-Object {$_.FullName -like "*nord*"}

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $originalContent = $content
    
    # Perform replacements
    $content = $content -replace 'exports\.varde_', 'exports.nord_'
    $content = $content -replace "varde_([a-z_])", 'nord_$1'
    $content = $content -replace "'Varde", "'Nord"
    $content = $content -replace '"Varde', '"Nord'
    $content = $content -replace "\[varde_", "[nord_"
    $content = $content -replace "varde:", "nord:"
    
    # Write back if changed
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "All files processed!"
