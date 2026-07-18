#!/bin/bash
# AI Helper — Git credential setup
# Run ONCE on your Chromebook Linux terminal:
#   bash ~/ai-helper-app/public/scripts/git-setup.sh YOUR_TOKEN
#
# After this, 'git pull' works forever with no prompts.

TOKEN="${1:-}"

if [ -z "${TOKEN}" ]; then
  echo "Usage: bash git-setup.sh YOUR_GITHUB_TOKEN"
  echo "Get a token at: https://github.com/settings/tokens/new (repo scope)"
  exit 1
fi

# Store token in git credential store
git config --global credential.helper store
printf 'https://Drag521:%s@github.com\n' "${TOKEN}" > "${HOME}/.git-credentials"
chmod 600 "${HOME}/.git-credentials"

# Update the remote URL in the ai-helper-app repo
if [ -d "${HOME}/ai-helper-app/.git" ]; then
  cd "${HOME}/ai-helper-app"
  git remote set-url origin "https://Drag521:${TOKEN}@github.com/Drag521/ai-helper.git"
  echo "✓ Remote URL updated"
fi

echo "✓ Git credentials stored at ~/.git-credentials"
echo ""
echo "Test it now:"
echo "  cd ~/ai-helper-app && git pull"
