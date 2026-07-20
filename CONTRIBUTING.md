# Contributing to AI Helper

Thank you for contributing! This guide will help you get started.

## Quick Start

1. **Fork & clone** the repository
2. **Install dependencies**: `pnpm install`
3. **Create a branch**: `git checkout -b feature/your-feature`
4. **Run dev server**: `pnpm dev`
5. **Make changes** and test them
6. **Push and create a PR**

## Development Workflow

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Configure .env with your values (at minimum DATABASE_URL)
```

### Running Locally

```bash
# Development server (port 13000)
pnpm dev

# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint --fix

# Tests
pnpm test

# Debug tests
pnpm test:debug

# Build for production
pnpm build
```

### Before Pushing

**Always run this checklist:**

```bash
# 1. Lint and fix issues
pnpm lint --fix

# 2. Type check
pnpm tsc --noEmit

# 3. Run tests
pnpm test

# 4. Build
pnpm build
```

If all pass, you're ready to push! ✅

## Code Standards

### TypeScript
- Use strict mode (no bare `any`)
- Import with `@/` path aliases
- Type all function parameters and returns

### Components
- One component per file
- Use PascalCase filenames
- Server components by default, client only when needed
- Import shadcn/ui from `@/components/ui/`

### Forms
- Use React Hook Form + Zod
- Always validate with Zod schema
- Show validation errors to user

### API Routes
- Use `handleApiError()` in catch blocks
- Return standardized `ApiResponse<T>`
- Validate input with Zod

### Testing
- Write tests for new features
- Use Playwright for E2E tests
- Test file location: `tests/feature.spec.ts`
- Run tests before pushing

## Making a PR

1. **Descriptive title**: "Add user authentication module"
2. **Clear description**: What changed and why
3. **Link issues**: "Closes #123"
4. **Wait for CI**: All checks must pass
5. **Address feedback**: Update based on review comments

### PR Checklist

- [ ] All tests pass locally (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm tsc --noEmit`)
- [ ] Build succeeds (`pnpm build`)
- [ ] New features have tests
- [ ] Documentation updated if needed
- [ ] Commit messages are clear

## Git Commit Messages

Use clear, descriptive commit messages:

```
✨ Add user authentication module

- Implement JWT token generation
- Add login/logout API routes  
- Add auth context for client-side usage
- Add unit tests for auth utilities

Closes #123
```

### Commit Message Format

- Use a verb: Add, Fix, Update, Remove, Refactor, etc.
- Keep first line under 50 characters
- Explain what and why, not how
- Reference issues: "Closes #123" or "Fixes #456"

## Database Changes

If you modify `db/schema.ts`:

```bash
# 1. Generate migration
pnpm db:generate

# 2. Review the generated migration in db/migrations/

# 3. Run migration locally
pnpm db:migrate

# 4. Commit both schema.ts and migration file
git add db/schema.ts db/migrations/
git commit -m "Add users table"
```

## Testing Guidelines

### Write Tests For:
- ✅ New API endpoints
- ✅ New components (especially interactive ones)
- ✅ Business logic/utilities
- ✅ Database queries

### Test Example

```typescript
import { test, expect } from '@playwright/test'

test('login form submits successfully', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button:has-text("Login")')
  await expect(page).toHaveURL('/dashboard')
})
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run single file
pnpm test tests/login.spec.ts

# Run with UI
pnpm test:ui

# Debug mode
pnpm test:debug

# Watch mode (reruns on changes)
pnpm test --watch
```

## Automated Workflows

### On Every Push/PR
- **Linting** — ESLint checks code style
- **Type Checking** — TypeScript validates types
- **Testing** — Playwright tests across 3 browsers
- **Build** — Next.js production build

View results: GitHub → Actions tab

### On Main Branch Push
- **Security Scan** — Dependency vulnerabilities
- **Deploy** — Automatic deployment to production

## Getting Help

- **Questions**: Open a discussion in GitHub Discussions
- **Bugs**: Create an issue with a reproduction example
- **Features**: Create an issue to discuss before implementing

## Code Review Expectations

Reviewers will check for:
- ✅ Code follows project conventions
- ✅ Tests cover new functionality
- ✅ No TypeScript/linting errors
- ✅ CI/CD checks pass
- ✅ Documentation is updated
- ✅ No hardcoded credentials or secrets

## Release Process

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.2.3`
4. Push tag: `git push origin v1.2.3`
5. GitHub Actions deploys automatically

## Project Structure

For working with new features:

```
ai-helper-app/
├── app/                    # Next.js app router
│   ├── page.tsx           # Homepage
│   ├── layout.tsx         # Root layout
│   └── api/               # API routes
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities & services
├── db/                    # Database schema & client
├── tests/                 # Playwright tests
├── public/                # Static assets
└── .github/
    └── workflows/         # CI/CD workflows
```

## TypeScript Paths

Use these path aliases:

```typescript
import { db } from '@/db'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { useStore } from '@/lib/store'
```

## Need More Help?

- **Conventions**: See `.github/copilot-instructions.md`
- **Quick Reference**: See `.github/CI_CD_REFERENCE.md`
- **Architecture**: See `docs/AI_GUIDE.md`

---

Happy coding! 🚀
