# Fix Nord: to nord: in all Lua files
$files = Get-ChildItem -Path "resources" -Recurse -Include "*.lua" | Where-Object {$_.FullName -like "*nord*"}

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $newContent = $content -replace "'Nord:", "'nord:" -replace '"Nord:', '"nord:'
    
    if ($newContent -ne $content) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent)
        Write-Host "Fixed: $($file.Name)"
    }
}

Write-Host "Done fixing Nord: to nord:"
