param(
  [string]$RepoName = "macau-family-trip",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "未找到 GitHub CLI。请先运行：winget install --id GitHub.cli"
}

if (-not (gh auth status 2>$null)) {
  throw "尚未登录 GitHub。请先运行：gh auth login"
}

$ProjectRoot = $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path ".git")) {
  git init
}

git add -A
git -c user.name="Codex" -c user.email="codex@local" commit -m "Prepare Macau family trip app for GitHub Pages" --allow-empty

gh repo create $RepoName --$Visibility --source . --remote origin --push

$RemoteUrl = git remote get-url origin
Write-Host "Repository pushed: $RemoteUrl"
Write-Host "If Pages is not enabled automatically by the workflow, run:"
Write-Host "gh api repos/{owner}/$RepoName/pages -X POST -f source[branch]=main -f source[path]=/"
