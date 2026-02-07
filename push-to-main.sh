#!/bin/bash
# Push to main: checkout main, commit file-by-file (no .md), push
# Run from repo root: bash push-to-main.sh
set -e
cd "$(dirname "$0")"

# 0. Remove stale lock
lock="$(git rev-parse --git-dir)/index.lock"
[ -f "$lock" ] && rm -f "$lock"

# 1. Stash, checkout main, pop
git stash push -u -m "push-to-main: temp stash" 2>/dev/null || true
git checkout main
git stash pop 2>/dev/null || true

add_existing() {
  for p in "$@"; do [ -e "$p" ] && git add "$p"; done
}

commit_if_staged() {
  git diff --cached --quiet || git commit -m "$1"
}

# 2. .gitignore
add_existing .gitignore
commit_if_staged "chore: update .gitignore (Python cache, venv)"

# 3. Backend config and database
add_existing backend/config/database.js backend/database/seed.js
commit_if_staged "backend: update database config and seed"

# 4. Backend middleware
add_existing backend/middleware/auth.js backend/middleware/admin.js
commit_if_staged "backend: auth and admin middleware"

# 5. Backend routes
add_existing backend/routes/analyze.js backend/routes/auth.js backend/routes/reports.js backend/routes/upload.js backend/routes/admin.js
commit_if_staged "backend: update routes (analyze, auth, reports, upload, admin)"

# 6. Backend server and services
add_existing backend/server.js backend/services/logger.js backend/setup-ocr.js backend/package.json
commit_if_staged "backend: server, logger, setup-ocr, package.json"

# 7. Backend OCR
add_existing backend/ocr-code/parsers/parth_parser.py backend/ocr-service/requirements.txt backend/requirements-ocr-service.txt
commit_if_staged "backend: OCR parsers and requirements"

# 8. Frontend package and utils
add_existing frontend/package.json frontend/src/utils/api.js frontend/src/utils/authStorage.js frontend/src/utils/socket.js
commit_if_staged "frontend: package.json and utils (api, authStorage, socket)"

# 9. Frontend App
add_existing frontend/src/App.js frontend/src/App.backup.js frontend/src/App.test.js
commit_if_staged "frontend: App and tests"

# 10. Frontend components
add_existing frontend/src/components/Login.js frontend/src/components/Signup.js frontend/src/components/UploadReport.js frontend/src/components/ResultsDisplay.js frontend/src/components/AdminDashboard.js frontend/src/components/ui/alert.jsx
commit_if_staged "frontend: Login, Signup, UploadReport, ResultsDisplay, AdminDashboard, alert"

# 11. ML service
add_existing ml-service/app.py ml-service/requirements.txt
commit_if_staged "ml-service: app and requirements"

# 12. Model assets
[ -d "Model" ] && git add Model/ && commit_if_staged "chore: add Model assets"

# 13. Root script
add_existing START_ALL.bat
commit_if_staged "chore: START_ALL.bat"

# 14. Deletions
git add fyp_material/ test-anonymized.html 2>/dev/null || true
[ -n "$(git diff --cached --name-only --diff-filter=D 2>/dev/null)" ] && git commit -m "chore: remove fyp_material and test-anonymized"

# 15. Push to origin main
git push -u origin main

echo "Done. Pushed to origin main."
