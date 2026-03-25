# Push to main: checkout main, commit file-by-file (no .md), push
# Run from repo root: .\push-to-main.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

# 0. Remove stale lock so git can run (close other Git processes if lock is busy)
$lock = Join-Path (git rev-parse --git-dir) "index.lock"
if (Test-Path $lock) { Remove-Item $lock -Force -ErrorAction SilentlyContinue }

# 1. Stash local changes, checkout main, reapply
git stash push -u -m "push-to-main: temp stash" 2>$null
git checkout main
git stash pop 2>$null

function Add-Existing {
  param([string[]]$Paths)
  $existing = $Paths | Where-Object { Test-Path $_ }
  if ($existing) { git add $existing }
}

function Commit-IfStaged {
  param([string]$Message)
  git diff --cached --quiet 2>$null; if ($LASTEXITCODE -ne 0) { git commit -m $Message }
}

# 2. .gitignore
Add-Existing @(".gitignore")
Commit-IfStaged "chore: update .gitignore (Python cache, venv)"

# 3. Backend config and database
Add-Existing @("backend/config/database.js", "backend/database/seed.js")
Commit-IfStaged "backend: update database config and seed"

# 4. Backend middleware
Add-Existing @("backend/middleware/auth.js", "backend/middleware/admin.js")
Commit-IfStaged "backend: auth and admin middleware"

# 5. Backend routes
Add-Existing @("backend/routes/analyze.js", "backend/routes/auth.js", "backend/routes/reports.js", "backend/routes/upload.js", "backend/routes/admin.js")
Commit-IfStaged "backend: update routes (analyze, auth, reports, upload, admin)"

# 6. Backend server and services
Add-Existing @("backend/server.js", "backend/services/logger.js", "backend/setup-ocr.js", "backend/package.json")
Commit-IfStaged "backend: server, logger, setup-ocr, package.json"

# 7. Backend OCR
Add-Existing @("backend/ocr-code/parsers/parth_parser.py", "backend/ocr-service/requirements.txt", "backend/requirements-ocr-service.txt")
Commit-IfStaged "backend: OCR parsers and requirements"

# 8. Frontend package and utils
Add-Existing @("frontend/package.json", "frontend/src/utils/api.js", "frontend/src/utils/authStorage.js", "frontend/src/utils/socket.js")
Commit-IfStaged "frontend: package.json and utils (api, authStorage, socket)"

# 9. Frontend App
Add-Existing @("frontend/src/App.js", "frontend/src/App.backup.js", "frontend/src/App.test.js")
Commit-IfStaged "frontend: App and tests"

# 10. Frontend components
Add-Existing @("frontend/src/components/Login.js", "frontend/src/components/Signup.js", "frontend/src/components/UploadReport.js", "frontend/src/components/ResultsDisplay.js", "frontend/src/components/AdminDashboard.js", "frontend/src/components/ui/alert.jsx")
Commit-IfStaged "frontend: Login, Signup, UploadReport, ResultsDisplay, AdminDashboard, alert"

# 11. ML service
Add-Existing @("ml-service/app.py", "ml-service/requirements.txt")
Commit-IfStaged "ml-service: app and requirements"

# 12. Model assets
if (Test-Path "Model") { git add Model/; Commit-IfStaged "chore: add Model assets" }

# 13. Root script
Add-Existing @("START_ALL.bat")
Commit-IfStaged "chore: START_ALL.bat"

# 14. Deletions
git add fyp_material/ 2>$null
git add test-anonymized.html 2>$null
$deleted = git diff --cached --name-only --diff-filter=D 2>$null
if ($deleted) { git commit -m "chore: remove fyp_material and test-anonymized" }

# 15. Push to origin main
git push -u origin main

Write-Host "Done. Pushed to origin main."
