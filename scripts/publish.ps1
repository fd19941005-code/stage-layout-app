[CmdletBinding()]
param(
  [string]$CommitMessage = "Publish stage layout updates",
  [string]$PrTitle = "Publish stage layout updates",
  [switch]$SkipChecks,
  [switch]$NoPr,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not available in PATH."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is not available in PATH."
}

& git rev-parse --show-toplevel *> $null
if ($LASTEXITCODE -ne 0) {
  throw "This script must run inside a Git repository."
}

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is not authenticated. Run 'gh auth login -h github.com -p https -w' once, then retry."
}

$statusBefore = @(git status --porcelain)
if ($statusBefore.Count -eq 0) {
  throw "There are no local changes to publish."
}

$branch = (& git branch --show-current).Trim()
$baseBranch = (& gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name').Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($baseBranch)) {
  throw "Could not determine the repository default branch."
}

if ($branch -eq $baseBranch) {
  $branch = "agent/publish-$(Get-Date -Format 'yyyyMMdd-HHmm')"
  Invoke-Step "Create publish branch $branch" { git switch -c $branch }
}

if (-not $SkipChecks) {
  Invoke-Step "Run tests" { npm run test }
  Invoke-Step "Run typecheck" { npm run typecheck }
  Invoke-Step "Run build" { npm run build }
}

# Backup archives and third-party research images are kept local and are not published.
Invoke-Step "Stage application changes" {
  git add -A -- . ':(exclude)docs.zip' ':(exclude)src.zip' ':(exclude)docs/orchestra_string_layout_8_to_16_collection/**'
}

$stagedFiles = @(git diff --cached --name-only)
if ($stagedFiles.Count -eq 0) {
  throw "No files were staged. Check the excluded files or repository status."
}

Write-Host ""
Write-Host "Staged changes:" -ForegroundColor Yellow
git diff --cached --stat
Write-Host ""

if (-not $Yes) {
  $confirmation = Read-Host "Commit and push these changes, then open a Draft PR? [y/N]"
  if ($confirmation -notmatch '^(?i:y|yes)$') {
    Write-Host "Cancelled before commit."
    exit 0
  }
}

Invoke-Step "Commit changes" { git commit -m $CommitMessage }
Invoke-Step "Push $branch" { git push -u origin $branch }

if ($NoPr) {
  Write-Host "Published branch: $branch" -ForegroundColor Green
  exit 0
}

$existingPr = (& gh pr list --head $branch --state open --json url --jq '.[0].url').Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Could not inspect existing pull requests."
}

if (-not [string]::IsNullOrWhiteSpace($existingPr)) {
  Write-Host "Draft PR already exists: $existingPr" -ForegroundColor Green
  exit 0
}

$bodyPath = Join-Path ([System.IO.Path]::GetTempPath()) "stage-layout-pr-$([guid]::NewGuid().ToString('N')).md"
try {
  $checks = if ($SkipChecks) {
    "- Automated checks were skipped with SkipChecks"
  } else {
    @(
      "- npm run test",
      "- npm run typecheck",
      "- npm run build"
    ) -join [Environment]::NewLine
  }
  $bodyLines = @(
    "## Changes",
    "",
    "Publish the current stage-layout-app implementation and supporting documentation.",
    "",
    "- Updated the app, tests, documentation, and GitHub Pages workflow",
    "- Excluded docs.zip, src.zip, and the third-party research image collection",
    "",
    "## Validation",
    "",
    $checks,
    "",
    "## Note",
    "",
    "- GitHub Pages updates after this PR is merged into main."
  )
  $bodyLines | Set-Content -LiteralPath $bodyPath -Encoding UTF8

  $prUrl = (& gh pr create --draft --base $baseBranch --head $branch --title $PrTitle --body-file $bodyPath).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Draft PR creation failed."
  }
  Write-Host "Draft PR created: $prUrl" -ForegroundColor Green
} finally {
  if (Test-Path -LiteralPath $bodyPath) {
    Remove-Item -LiteralPath $bodyPath -Force
  }
}
