param(
  [string]$RepoName = "macau-family-trip",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

$Token = $env:GH_TOKEN
if (-not $Token) { $Token = $env:GITHUB_TOKEN }
if (-not $Token) {
  $SecureToken = Read-Host "Paste your GitHub Token (input is hidden)" -AsSecureString
  $Token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
  )
}
if (-not $Token) {
  throw "GitHub Token was not provided."
}

$Headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "User-Agent" = "Codex"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$Api = "https://api.github.com"
$ProjectRoot = $PSScriptRoot

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Uri,
    $Body = $null
  )
  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = $Body | ConvertTo-Json -Depth 10
  }
  Invoke-RestMethod @params
}

$CurrentUser = Invoke-GitHubJson -Method Get -Uri "$Api/user"
$Owner = $CurrentUser.login
Write-Host "GitHub account: $Owner"

$repoPayload = @{
  name = $RepoName
  description = "Macau Family Trip PWA"
  homepage = "https://$Owner.github.io/$RepoName/"
  private = ($Visibility -eq "private")
  auto_init = $true
}

try {
  $Repo = Invoke-GitHubJson -Method Post -Uri "$Api/user/repos" -Body $repoPayload
  Write-Host "Repository created: $($Repo.html_url)"
}
catch {
  $message = $_.Exception.Message
  if ($message -match "422") {
    Write-Host "Repository may already exist; continuing upload."
  } else {
    throw
  }
}

$ExcludeDirs = @(".git", ".tools", ".github")
$Files = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File | Where-Object {
  $relative = $_.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")
  $parts = $relative -split "[\\/]"
  $parts[0] -notin $ExcludeDirs
}

foreach ($File in $Files) {
  $relative = $File.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/").Replace("\", "/")
  $bytes = [System.IO.File]::ReadAllBytes($File.FullName)
  $content = [Convert]::ToBase64String($bytes)
  $payload = @{
    message = "Upload $relative"
    content = $content
    branch = "main"
  }
  $encodedPath = [System.Uri]::EscapeDataString($relative).Replace("%2F", "/")
  Invoke-GitHubJson -Method Put -Uri "$Api/repos/$Owner/$RepoName/contents/$encodedPath" -Body $payload | Out-Null
  Write-Host "Uploaded: $relative"
}

$pagesPayload = @{
  source = @{
    branch = "main"
    path = "/"
  }
}

try {
  Invoke-GitHubJson -Method Post -Uri "$Api/repos/$Owner/$RepoName/pages" -Body $pagesPayload | Out-Null
  Write-Host "Pages enabled."
}
catch {
  Write-Host "Pages may already be enabled, or the token lacks Pages permission."
}

$PageUrl = "https://$Owner.github.io/$RepoName/"
Write-Host ""
Write-Host "Expected URL: $PageUrl"
Write-Host "GitHub usually completes the first build within 1-2 minutes."
