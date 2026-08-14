$ErrorActionPreference = "Stop"

$Project = Join-Path $PSScriptRoot ""
$Port = 8080
$Url = "http://localhost:$Port"

Set-Location -LiteralPath $Project
Write-Host "正在启动：$Url"
Write-Host "按 Ctrl+C 停止服务器。"

Start-Process $Url
python -m http.server $Port
