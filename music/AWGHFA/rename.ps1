$dir = "C:\Users\wob21\Desktop\wq"
Get-ChildItem -Path $dir -Filter *.mp3 | ForEach-Object {
    $old = $_.BaseName
    $ext = $_.Extension

    $parts = $old -split '[-–—]'
    $candidates = @()
    foreach ($p in $parts) {
        $s = $p
        $s = $s -replace '\s*\(.*?\)',''
        $s = $s -replace '\s*\(\s*\d+\s*\)',''
        $s = $s -replace '\s*\[.*?\]',''
        $s = $s -replace '\s*【.*?】',''
        $s = $s -replace '\s*（.*?）',''
        $s = $s -replace '(?i)\b(4k|8k|gmv|mv|video|official|audio|hd|hq|lyrics|lyricvideo|cover|live|remix|feat\.?|featuring|ft\.?)\b',''
        $s = $s -replace '\d+',''
        $s = $s -replace '[^A-Za-z ]',' '
        $s = ($s -replace '\s+',' ').Trim()
        if (-not [string]::IsNullOrWhiteSpace($s)) { $candidates += $s }
    }

    if ($candidates.Count -gt 0) {
        $name = $candidates | Sort-Object { $_.Length } -Descending | Select-Object -First 1
    } else {
        $name = ($old -replace '[^A-Za-z ]',' ' -replace '\s+',' ').Trim()
    }

    if ([string]::IsNullOrWhiteSpace($name)) { $name = "Unknown" }

    $newName = $name + $ext
    $i = 1
    $candidate = $newName
    while (Test-Path (Join-Path $dir $candidate)) {
        $candidate = "{0} ({1}){2}" -f $name, $i, $ext
        $i++
    }

    if ($candidate -ne $_.Name) {
        Write-Host "Renaming '$($_.Name)' -> '$candidate'"
        Rename-Item -LiteralPath $_.FullName -NewName $candidate
    } else {
        Write-Host "Skipping '$($_.Name)' (no change)"
    }
}
