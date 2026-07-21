#!/bin/bash
set -e

echo "🚀 Updating Node.js support to 24..."

# Update CI
if [ -f .github/workflows/ci.yml ]; then
  sed -i 's/node-version: "20"/node-version: "24"/g' .github/workflows/ci.yml
  echo "✅ Updated .github/workflows/ci.yml"
else
  echo "⚠️ ci.yml not found"
fi

# Update Dockerfile
if [ -f Dockerfile ]; then
  sed -i 's/node:22-slim/node:24-slim/g' Dockerfile
  echo "✅ Updated Dockerfile"
else
  echo "⚠️ Dockerfile not found"
fi

# Update package.json
if [ -f package.json ]; then
  sed -i 's/"@types\/node": "\^22"/"@types\/node": "^24"/g' package.json
  
  if ! grep -q '"engines"' package.json; then
    awk '/"private": true,/ {print; print "  \"engines\": {\n    \"node\": \">=24.0.0\"\n  },"; next}1' package.json > tmp.json && mv tmp.json package.json
    echo "✅ Added \"engines\" field to package.json"
  fi
  echo "✅ Updated package.json"
else
  echo "⚠️ package.json not found"
fi

echo ""
echo "🎉 Done!"
echo "Next steps:"
echo "   pnpm install"
echo "   pnpm build"
echo "   git status"
echo ""
echo "If everything looks good:"
echo "   git add .github/workflows/ci.yml Dockerfile package.json"
echo "   git commit -m 'chore: upgrade Node.js from 20 to 24'"
echo "   git push"
