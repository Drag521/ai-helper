# CI/CD Quick Reference

## GitHub Actions Workflows

### 1. **Copilot Setup Steps** (`.github/workflows/copilot-setup-steps.yml`)
- **When**: Before Copilot starts working
- **Purpose**: Pre-install all tools and dependencies
- **Duration**: ~2-3 minutes
- **Tools installed**: Node.js, pnpm, Playwright, GitHub CLI, Docker, git-lfs, system tools

### 2. **CI Pipeline** (`.github/workflows/ci.yml`)
- **When**: Every push + pull request to `main`/`develop`
- **Purpose**: Validate code quality and functionality
- **Jobs** (parallel):
  - `lint` — ESLint + TypeScript type check (~1 min)
  - `test` — Playwright tests across 3 browsers (~3-5 min)
  - `build` — Next.js production build (~2-3 min)
  - `all-checks-pass` — Gate job (requires all above)
- **Duration**: ~5-8 minutes total
- **Artifacts**: Playwright reports (30 days), build files (7 days)
- **Fails if**: Linting errors, type errors, test failures, or build failure

### 3. **Deploy Pipeline** (`.github/workflows/deploy.yml`)
- **When**: Pushes to `main` branch only (can also manual trigger)
- **Purpose**: Validate + deploy to production
- **Pre-steps**: Full lint, type check, test suite, build
- **Deploy steps**: Placeholder for your deployment logic
- **Duration**: ~10-15 minutes (including all validation)
- **Requires**: GitHub environment `production` configured with secrets
- **Status**: Shows deployment status in GitHub UI

## Quick Commands for Local Testing

```bash
# Run all validation locally (same as CI)
pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build

# Quick checks before pushing
pnpm lint && pnpm tsc --noEmit

# Run tests with detailed output
pnpm test:debug

# View Playwright report after tests
pnpm test && open playwright-report/index.html

# Build for production
pnpm build
```

## PR Workflow

1. **Make changes** → Commit
2. **Push branch** → Create PR
3. **GitHub Actions runs automatically**:
   - Lint & Type Check job (1 min)
   - Test job (4 min)
   - Build job (2 min)
4. **Check PR status**:
   - Green ✅ = All checks passed, safe to merge
   - Red ❌ = Click "Details" to see what failed
5. **Fix + Push** → Jobs re-run automatically
6. **Merge** when all checks pass + reviews done

## Viewing Workflow Results

### In GitHub UI
1. Go to repository
2. Click **Actions** tab
3. Click workflow name (e.g., "CI")
4. Click run to see details
5. Click job name to expand logs

### For PR
1. Go to pull request
2. Scroll to "Checks" section
3. Click on failed check to see logs
4. Download artifacts (test reports, etc.)

## Debugging Failed CI

| What failed | First check | How to fix |
|-------------|------------|-----------|
| Lint | Job log output | Run `pnpm lint --fix` locally |
| Type errors | Job log output | Run `pnpm tsc --noEmit` locally |
| Tests | Download `playwright-report` | Look at failure traces/screenshots |
| Build | Job log output | Run `pnpm build` locally to reproduce |

## Environment Secrets for Deploy

To enable the deploy workflow, configure in GitHub:
1. Go to repo Settings
2. Environments → Create "production" environment
3. Add secrets like:
   - `DATABASE_URL`
   - `API_KEYS`
   - `DEPLOY_TOKEN`
   - Any other credentials needed

## Branch Protection Rules

Recommended setup in GitHub Settings → Branches:
```
Branch name: main

✓ Require a pull request before merging
✓ Require status checks to pass before merging
  - Select "All Checks Pass" from the CI workflow
✓ Require code reviews
  - Number of approvals: 1
✓ Dismiss stale pull request approvals when new commits are pushed
✓ Include administrators
```

This ensures:
- No direct pushes to main
- All tests must pass before merge
- At least 1 code review required
- Tests re-run if reviewers change code
