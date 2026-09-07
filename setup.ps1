<#
.SYNOPSIS
  One-time setup for the Business Self-Evaluation Tool project, including
  wiring it up so opencode (opencode.ai) can assist you inside VS Code.

.NOTES
  Run this from the "business-evaluator" folder in a VS Code PowerShell
  terminal:  .\setup.ps1
  If script execution is blocked, run once (per PowerShell session):
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>

Write-Host "== Business Self-Evaluation Tool: setup ==" -ForegroundColor Cyan

# 1. Git init (safe to re-run)
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init | Out-Null
    @"
node_modules/
.opencode/local/
*.log
"@ | Out-File -Encoding utf8 .gitignore
    git add -A
    git commit -m "Initial scaffold: Business Self-Evaluation Tool" | Out-Null
} else {
    Write-Host "Git repo already present, skipping init." -ForegroundColor DarkGray
}

# 2. Check Node.js (needed only if you want a local dev server or opencode via npm)
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host "Node.js found: $(node --version)" -ForegroundColor Green
} else {
    Write-Host "Node.js not found. You do NOT need it to just open index.html," -ForegroundColor Yellow
    Write-Host "but you WILL need it to run 'npm install -g opencode-ai' or 'npx serve'." -ForegroundColor Yellow
    Write-Host "Get it from https://nodejs.org (LTS) if you want those options." -ForegroundColor Yellow
}

# 3. Check for opencode CLI
$opencode = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencode) {
    Write-Host "opencode CLI found: $(opencode --version)" -ForegroundColor Green
} else {
    Write-Host "opencode CLI not found." -ForegroundColor Yellow
    if ($node) {
        $answer = Read-Host "Install it now via 'npm install -g opencode-ai'? (y/n)"
        if ($answer -eq "y") {
            npm install -g opencode-ai
        }
    } else {
        Write-Host "Install Node.js first, or use: irm https://opencode.ai/install | iex (WSL/curl-based install)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "== Next steps ==" -ForegroundColor Cyan
Write-Host "1. Open this folder in VS Code (code .)"
Write-Host "2. Preview the app: double-click index.html, OR run 'npm start' (needs Node), OR use the Live Server extension."
Write-Host "3. Start opencode in this folder:  opencode"
Write-Host "   - AGENTS.md and opencode.json are already set up, so opencode already knows the project structure and conventions."
Write-Host "   - Try asking it things like:"
Write-Host "       'Add an 8th category for Legal & Compliance with 5 questions and recommendations'"
Write-Host "       'Add a PDF export option next to the existing .txt export'"
Write-Host "       'Add a print-friendly stylesheet for the results section'"
Write-Host "Done." -ForegroundColor Cyan
