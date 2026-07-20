# Copilot Instructions for AI Helper

This document provides essential patterns, commands, and conventions for working on this project.

## Build, Test & Lint

### Running the Application
- **Development server** (port 13000): `pnpm dev`
- **Production build**: `pnpm build`
- **Production start**: `pnpm start`
- **Linting**: `pnpm lint`

### Testing
- **Run all tests**: `pnpm test` (Playwright in headless mode)
- **Run tests with UI**: `pnpm test:ui` (opens interactive Playwright Inspector)
- **Run tests in debug mode**: `pnpm test:debug` (step-through debugging)
- **Run tests with browser visible**: `pnpm test:headed` (see browser automation)
- **Run tests for single browser**: `pnpm test -- --project=chromium` (or firefox/webkit)
- **Run single test file**: `pnpm test tests/example.spec.ts`
- **Run tests matching pattern**: `pnpm test -- --grep "homepage"`

Test reports are generated in `playwright-report/` after each run.

### Database Commands
- **Generate migrations**: `pnpm db:generate` (after schema changes in `db/schema.ts`)
- **Run migrations**: `pnpm db:migrate`
- **Open Drizzle Studio**: `pnpm db:studio`

### Type Checking & Validation
- **TypeScript check**: `pnpm tsc --noEmit`
- **Build with type checking**: `pnpm build` (includes type check)

### Important Notes
- **TypeScript strict mode enabled** — all code must pass type checking before building
- **ESLint configured** with exceptions for React patterns (`any` types allowed, several rules relaxed)
- **Playwright tests** run in parallel across Chromium, Firefox, and WebKit by default
- Test server auto-starts on `http://localhost:13000` during test runs
- Failed tests are automatically retried once in CI, zero times locally

## Architecture

### High-Level Overview
This is a Next.js 16 application serving as an AI helper terminal interface for Chromebook/Linux automation:

1. **Frontend**: React 19 with shadcn/ui components, Tailwind CSS 4, Zustand for state
2. **Backend**: Next.js API routes handling script execution, configuration, and logging
3. **Database**: PostgreSQL via Drizzle ORM (if used)
4. **UI Framework**: React Hook Form + Zod for validation, Sonner for notifications

### Key Directories
- **`app/`** — Next.js App Router pages and API routes
  - `app/page.tsx` — Main UI
  - `app/api/terminal/` — Shell command execution endpoint
  - `app/api/config/`, `app/api/logs/`, `app/api/scripts/`, `app/api/agent/` — Other endpoints
- **`lib/`** — Core utilities and business logic
  - `lib/errors.ts` — Custom error classes and `handleApiError()`
  - `lib/request.ts` — API client wrapper (`apiClient`)
  - `lib/env.ts` — Environment variable validation
  - `lib/logger.ts` — Logging utility
  - `lib/store.ts` — Zustand state store
  - `lib/runner.ts` — Script execution logic
  - `lib/projects.ts` — Project management utilities
- **`db/`** — Database schema and client
  - `db/schema.ts` — Drizzle ORM table definitions
  - `db/index.ts` — Database client instance
- **`components/`** — React UI components
  - All components use Tailwind CSS + shadcn/ui patterns
  - `components/ui/` — Primitive UI components (buttons, inputs, modals, etc.)
- **`hooks/`** — Custom React hooks (e.g., `use-mobile`, `use-toast`)
- **`public/scripts/`** — Bash scripts for automation (boot, maintenance, watchdog, shizuku runner)

## Key Conventions

### 1. TypeScript & Typing
- **Strict mode enabled** — all `unknown` types must be cast explicitly
- **Path aliases**: Use `@/` prefix for imports (e.g., `@/lib/errors`, `@/db`, `@/components/ui/button`)
- **No bare `any` types** — use generic constraints or specific interfaces instead
- **Type definitions**: Go in `types/` or as interfaces adjacent to usage
- **Server vs Client types**: Use `'use client'` directive in components that need interactivity; server components by default

**Example**:
```typescript
import { apiClient } from '@/lib/request'
import type { ApiResponse } from '@/lib/request'

const response: ApiResponse<User> = await apiClient.get('/api/users/1')
```

### 2. Error Handling
All errors follow a standardized pattern:

```typescript
// In lib/errors.ts — use these classes
export class AppError extends Error { /* ... */ }
export class ValidationError extends AppError { /* ... */ }
export class UnauthorizedError extends AppError { /* ... */ }
export class NotFoundError extends AppError { /* ... */ }

// In API routes — always wrap with handleApiError()
import { handleApiError } from '@/lib/errors'

try {
  const result = await someService()
  return NextResponse.json({ success: true, data: result })
} catch (error) {
  const errorResponse = handleApiError(error)
  return NextResponse.json(errorResponse, { 
    status: errorResponse.status ?? 500 
  })
}
```

Error responses always return:
```typescript
{
  success: false,
  error: string,
  status: number
}
```

### 3. API Response Format
Client-side API calls return a standardized `ApiResponse<T>`:

```typescript
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

// Usage pattern:
const response = await apiClient.post('/api/endpoint', payload)
if (response.success) {
  const data: MyType = response.data!
  toast.success('Operation completed')
} else {
  toast.error(response.error || 'Something went wrong')
}
```

API routes should return data directly on success (handled by `apiClient`):
```typescript
// In /app/api/users/route.ts
export async function GET() {
  const users = await db.query.users.findMany()
  return NextResponse.json(users) // client receives { success: true, data: users }
}
```

### 4. Forms & Validation
All forms use **React Hook Form + Zod**:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const FormSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name required'),
  age: z.number().int().positive().optional(),
})

type FormData = z.infer<typeof FormSchema>

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: '', name: '' },
  })

  const onSubmit = async (data: FormData) => {
    const response = await apiClient.post('/api/submit', data)
    if (response.success) {
      toast.success('Form submitted')
    } else {
      toast.error(response.error)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

### 5. UI Patterns
- **Notifications**: Use `toast()` from `sonner`
  - `toast.success('Action completed')`
  - `toast.error('Something went wrong')`
  - `toast.loading('Processing...')`
  - `toast.promise(promise, { loading: '...', success: '...', error: '...' })`
  
- **Components**: Build using shadcn/ui primitives in `components/ui/`
  - Import: `import { Button } from '@/components/ui/button'`
  - Compose from atomic building blocks

- **Styling**: Tailwind CSS classes
  - Use `cn()` from `@/utils` to conditionally merge class names
  - Example: `cn('px-4 py-2', isActive && 'bg-blue-500')`

- **Client vs. Server**:
  - Server components by default (can access DB directly)
  - Client components only for interactivity (`'use client'` directive at top)
  - Client components use `apiClient` from `@/lib/request` for API calls
  - Mix server and client: server layouts can render client components

### 6. Database
- **Define tables** in `db/schema.ts` using Drizzle ORM
- **Import `db`** from `@/db` in server components or API routes
- **After schema changes**:
  1. Run `pnpm db:generate` to create migration
  2. Run `pnpm db:migrate` to apply
  3. Commit both `db/migrations/` and `db/schema.ts`

**Example schema**:
```typescript
// db/schema.ts
import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Usage in server component:
import { db } from '@/db'

const users = await db.query.users.findMany()
const user = await db.insert(users).values({ email: 'test@example.com' })
```

### 7. Environment Variables
- **Define** in `.env` (copy from `.env.example` template)
- **Validate** with `env` export from `@/lib/env.ts` on startup
- **Access on server side only**
- **Use `NEXT_PUBLIC_*` prefix** for client-visible variables (e.g., `NEXT_PUBLIC_API_URL`)
- **Never commit `.env`** — it contains secrets

**Example**:
```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

### 8. State Management
Use **Zustand** for client-side state (`@/lib/store.ts`):

```typescript
import { create } from 'zustand'

interface AppStore {
  count: number
  increment: () => void
  decrement: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))

// In a client component:
'use client'
import { useAppStore } from '@/lib/store'

export function Counter() {
  const { count, increment } = useAppStore()
  return <button onClick={increment}>{count}</button>
}
```

### 9. Logging
Use the `logger` from `@/lib/logger.ts`:

```typescript
import { logger } from '@/lib/logger'

logger.info('User login', { userId: 123, timestamp: Date.now() })
logger.error('Database connection failed', { error, context: 'startup' })
logger.warn('Slow API response', { duration_ms: 5000 })
```

Logs are structured (JSON-friendly) and context-aware.

### 10. Script Execution
The app runs bash scripts from `~/ai-helper/scripts/`:
- **Scripts copied at setup** from `public/scripts/` to runtime directory
- **Terminal API** (`app/api/terminal/route.ts`) handles arbitrary command execution
- **Environment context**: Scripts receive HOME, NVM_DIR, TERM, and other env vars
- **Timeout default**: 30 seconds (configurable per request)
- **Max buffer**: 5MB stdout/stderr

**Example terminal request**:
```typescript
const response = await apiClient.post('/api/terminal', {
  command: 'ls -la',
  cwd: '~/my-project',
  timeout_seconds: 60,
})
// Response: { status, stdout, stderr, exit_code, duration_ms }
```

### 11. Testing Patterns
Use **Playwright** for E2E testing:

```typescript
import { test, expect } from '@playwright/test'

test('user can submit form', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.click('button:has-text("Submit")')
  await expect(page.locator('text=Success')).toBeVisible()
})

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('loads navigation', async ({ page }) => {
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
  })
})
```

Test structure:
- Tests go in `tests/**/*.spec.ts`
- Run `pnpm test` to execute all tests
- Use `test.skip()` to disable temporarily
- Use `test.only()` for single test during development

### 12. Naming Conventions
- **Components**: PascalCase (e.g., `UserCard.tsx`, `NavSidebar.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useStore`, `useMobile`)
- **Types/Interfaces**: PascalCase (e.g., `User`, `ApiResponse`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **API routes**: lowercase kebab-case in URL (e.g., `/api/run-step`, `/api/agent-config`)
- **Database tables**: lowercase snake_case (e.g., `user_profiles`, `task_logs`)

### 13. File Organization
- **One component per file** — no barrel exports for components
- **Co-locate types** with their usage (or in `types/` if shared)
- **Utilities**: Group related utilities together in `lib/`
- **Services**: Business logic in `lib/` or API route handlers
- **Tests**: Mirror source structure in `tests/` (e.g., `tests/lib/errors.spec.ts` mirrors `lib/errors.ts`)

## MCP Servers & External Tools

This project is configured with the following MCP (Model Context Protocol) servers and tools to enhance Copilot's capabilities:

### Playwright (Web UI Testing)
- **Purpose**: End-to-end testing of UI components and user flows
- **Usage**: Write tests in `tests/**/*.spec.ts` using Playwright's API
- **Commands**:
  - Run tests: `pnpm test`
  - Debug mode: `pnpm test:debug`
  - Interactive UI: `pnpm test:ui`
  - Single file: `pnpm test tests/example.spec.ts`
- **Browsers**: Chromium, Firefox, WebKit all pre-installed
- **Configuration**: See `playwright.config.ts`
- **Reports**: Generated in `playwright-report/` after runs

### GitHub CLI
- **Purpose**: Interact with GitHub API, manage PRs, issues, and workflows
- **Usage**: Query PR status, create issues, manage deployment environments
- **Commands**: `gh pr list`, `gh issue create`, `gh workflow run`
- **Pre-installed in Copilot environment** via setup steps

### Docker CLI
- **Purpose**: Build, run, and manage Docker containers
- **Usage**: Test containerization, verify Dockerfile builds, run services
- **Commands**: `docker build`, `docker run`, `docker compose`
- **Pre-installed in Copilot environment** via setup steps

### System Utilities
The following are also pre-installed for development:
- **git-lfs**: Git Large File Storage for versioning large files
- **jq**: Command-line JSON processor
- **curl**: HTTP requests and API testing
- **postgresql-client**: Connect to PostgreSQL databases

## Dependencies

### Core Framework
- **Next.js 16** — React meta-framework with App Router
- **React 19** — UI library with latest hooks and features
- **TypeScript 5** — Static typing and type safety

### Database & ORM
- **Drizzle ORM** — TypeScript ORM for PostgreSQL
- **postgres** — Native PostgreSQL client driver

### UI & Styling
- **Tailwind CSS 4** — Utility-first CSS framework
- **shadcn/ui** — Pre-built React components (via `components/ui/`)
- **sonner** — Toast notification library

### Forms & Validation
- **React Hook Form** — Performant form library
- **@hookform/resolvers** — Zod integration for RHF
- **Zod** — TypeScript-first schema validation

### State Management
- **Zustand** — Lightweight state management library

### AI & Integration
- **AI SDK** — Vercel AI SDK for LLM integrations
- **@ai-sdk/openai** — OpenAI provider for AI SDK
- **@e2b/code-interpreter** — Code execution in sandboxed environment
- **firecrawl** — Web scraping and data extraction

### Development Tools
- **@playwright/test** — E2E and component testing
- **drizzle-kit** — Database migration tooling
- **ESLint** — Code linting (Next.js + TypeScript config)

## Recommended Package Manager

Use **pnpm** (already configured):
- Faster than npm
- Strict dependency resolution
- Better disk space usage
- Workspace support (if needed)

Always use `pnpm` instead of `npm` or `yarn`.

## CI/CD Pipelines

This project uses GitHub Actions for automated testing, building, and deployment.

### Main CI Pipeline (`.github/workflows/ci.yml`)
Runs on every push to `main`/`develop` and on all pull requests.

**Jobs**:
1. **Lint & Type Check** (`lint` job)
   - Runs ESLint: `pnpm lint`
   - Runs TypeScript check: `pnpm tsc --noEmit`
   - Fails the workflow if issues found

2. **Playwright Tests** (`test` job)
   - Installs browser engines (Chromium, Firefox, WebKit)
   - Runs: `pnpm test`
   - Uploads `playwright-report/` as artifact (30-day retention)
   - Reports test failures with detailed logs

3. **Build** (`build` job)
   - Runs: `pnpm build`
   - Uploads `.next/` build artifact (7-day retention)
   - Validates production build succeeds

4. **All Checks Pass** (`all-checks-pass` job)
   - Gate job: fails if any of the above fail
   - Requires all jobs to pass before merge

**Concurrency**: Only one workflow run per branch at a time; new pushes cancel in-progress runs (faster feedback).

### Deployment Pipeline (`.github/workflows/deploy.yml`)
Runs on pushes to `main` branch and can be manually triggered.

**Pre-deployment validation**:
- Lint check
- Type checking
- Full test suite
- Production build

**Deployment steps**:
1. Creates GitHub Deployment
2. Uploads build to target environment
3. Marks deployment as success/failure
4. Updates GitHub deployment status

**Configuration needed**:
- Set deployment target URL in `environment.url`
- Implement upload/restart logic in "Upload to deployment target" step
- Configure environment secrets in GitHub (Settings → Environments → production)
- Set required reviewers if desired

### Pull Request Checks
When you open a PR:
- All CI jobs run automatically
- Results show in PR checks section
- Branch protection rules can require passing checks before merge
- Test reports and artifacts available in "Checks" tab

### Local Testing Before Push
Run these locally to catch issues before CI:
```bash
# Lint
pnpm lint

# Type check
pnpm tsc --noEmit

# Tests
pnpm test

# Build
pnpm build
```

### Viewing CI Results
1. **In GitHub UI**: Go to repo → **Actions** tab
2. **For specific PR**: PR page → **Checks** tab
3. **View logs**: Click workflow run → click job → view logs
4. **Download artifacts**: Workflow run → scroll to Artifacts → download
5. **Test reports**: Download `playwright-report` artifact, open `index.html` in browser

### Debugging Failed Workflows
1. Check **Lint & Type Check** first — often reveals immediate issues
2. Check **Test** job for failing tests
3. Check **Build** job for compilation errors
4. Look at artifact uploads: test reports provide detailed failure info
5. Reproduce locally: run same commands as CI job

### Branch Protection Rules (Recommended)
In GitHub → Settings → Branches → Add branch protection rule:
- Branch name pattern: `main`
- Require status checks to pass: Select `All Checks Pass`
- Require PR reviews: Optional but recommended
- Require code owners approval: If using CODEOWNERS file
- Dismiss stale PR approvals: Recommended

This prevents merging until CI passes and PRs are reviewed.

## Copilot's Role in CI/CD

When Copilot makes changes, the CI/CD pipelines automatically validate them:

1. **Type Safety**: TypeScript strict mode catches type errors immediately
2. **Linting**: ESLint ensures consistent code style
3. **Functional Testing**: Playwright tests verify UI and API behavior
4. **Build Validation**: Production build catches configuration issues
5. **Test Reports**: Playwright artifacts show exactly what failed and why

**Best practices for Copilot**:
- Always run `pnpm test` locally before committing complex changes
- Check the Playwright report if tests fail: look at screenshots/traces
- Ensure all 4 CI jobs pass before merging PRs
- Use `pnpm tsc --noEmit` to catch type errors early
- Review test coverage: add tests when adding new features

## Relevant Documentation
- See `docs/AI_GUIDE.md` for additional conventions
- See `SETUP_GUIDE.md` for deployment/installation details
