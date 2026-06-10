# download-ffmpeg.ps1
# Downloads the correct static build of FFmpeg and places it in the src-tauri folder as a sidecar.

$Uri = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$ZipFile = Join-Path $PSScriptRoot "ffmpeg.zip"
$ExtractDir = Join-Path $PSScriptRoot "ffmpeg-temp"
$TargetFile = Join-Path $PSScriptRoot "ffmpeg-x86_64-pc-windows-msvc.exe"

Write-Host "Downloading FFmpeg from $Uri..."
Invoke-WebRequest -Uri $Uri -OutFile $ZipFile

Write-Host "Extracting archive..."
Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir

Write-Host "Locating ffmpeg.exe..."
$ffmpegExe = Get-ChildItem -Path $ExtractDir -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1

if ($ffmpegExe) {
    Write-Host "Copying ffmpeg.exe to $TargetFile..."
    Copy-Item $ffmpegExe.FullName -Destination $TargetFile -Force
    Write-Host "FFmpeg sidecar setup completed successfully."
} else {
    Write-Error "Could not find ffmpeg.exe in the extracted archive."
    exit 1
}

Write-Host "Cleaning up temporary files..."
Remove-Item $ZipFile -Force
Remove-Item $ExtractDir -Recurse -Force
