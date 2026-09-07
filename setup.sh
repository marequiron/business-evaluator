#!/usr/bin/env bash
# One-time setup for the Business Self-Evaluation Tool project (macOS/Linux/WSL).
# Run from the "business-evaluator" folder:  bash setup.sh

set -e
echo "== Business Self-Evaluation Tool: setup =="

# 1. Git init (safe to re-run)
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init >/dev/null
  cat > .gitignore <<'EOF'
node_modules/
.opencode/local/
*.log
EOF
  git add -A
  git commit -m "Initial scaffold: Business Self-Evaluation Tool" >/dev/null
else
  echo "Git repo already present, skipping init."
fi

# 2. Check Node.js
if command -v node >/dev/null 2>&1; then
  echo "Node.js found: $(node --version)"
else
  echo "Node.js not found. You do NOT need it to just open index.html,"
  echo "but you WILL need it to run 'npm install -g opencode-ai' or 'npx serve'."
  echo "Get it from https://nodejs.org (LTS) if you want those options."
fi

# 3. Check for opencode CLI
if command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI found: $(opencode --version)"
else
  echo "opencode CLI not found."
  if command -v node >/dev/null 2>&1; then
    read -p "Install it now via 'npm install -g opencode-ai'? (y/n) " answer
    if [ "$answer" = "y" ]; then
      npm install -g opencode-ai
    fi
  else
    echo "Install via: curl -fsSL https://opencode.ai/install | bash"
  fi
fi

echo ""
echo "== Next steps =="
echo "1. Open this folder in VS Code (code .)"
echo "2. Preview the app: open index.html directly, OR run 'npm start' (needs Node), OR use the Live Server extension."
echo "3. Start opencode in this folder:  opencode"
echo "   - AGENTS.md and opencode.json are already set up, so opencode already knows the project structure and conventions."
echo "   - Try asking it things like:"
echo "       'Add an 8th category for Legal & Compliance with 5 questions and recommendations'"
echo "       'Add a PDF export option next to the existing .txt export'"
echo "       'Add a print-friendly stylesheet for the results section'"
echo "Done."
