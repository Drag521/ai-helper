#!/bin/bash
set -e

echo "Fixing pnpm setup for Node 24..."

FILES=$(find .github/workflows -name "*.yml" -o -name "*.yaml")

for file in $FILES; do
  # Replace Node version
  sed -i 's/node-version: ["'\'']20["'\'']/node-version: "24"/g' "$file"
  sed -i 's/node-version: 20/node-version: "24"/g' "$file"
  
  # Improve pnpm installation (more reliable way)
  sed -i 's/npm install -g pnpm/corepack enable \&\& corepack prepare pnpm@latest --activate/g' "$file"
done

echo "All workflows updated!"
grep -r "node-version:" .github/workflows/ --include="*.yml"
