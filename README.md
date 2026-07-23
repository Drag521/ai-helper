# ai-helper

**Personal AI-powered automation tool & self-improving Next.js template.**

A full-stack foundation with strong AI agent capabilities, database, modern UI, and autonomous self-evolution.

## Features
- **AI Core**: Groq + OpenAI + E2B code interpreter + Firecrawl + custom agent framework
- **Self-Improving Agent**: Autonomous code evolution via scheduled workflows
- **Database**: Drizzle ORM + PostgreSQL (ready for production)
- **UI**: Next.js 16 + React 19 + Tailwind 4 + full shadcn/ui + Sonner
- **Testing**: Playwright + TypeScript strict checks
- **DevOps**: Docker, docker-compose, systemd, GitHub Actions

## Tech Stack
- Next.js 16 (App Router) • React 19 • TypeScript 5
- Tailwind CSS 4 • Radix UI + shadcn
- Drizzle ORM + postgres • Zod + React Hook Form
- AI: `ai` SDK, `@ai-sdk/groq`, `agentation`

## Quick Start
1. `pnpm install`
2. Copy `.env.example` → `.env` and set `DATABASE_URL`
3. `pnpm dev` (runs on port 13000)
4. Database: `pnpm db:generate && pnpm db:migrate`

## Project Structure (key folders)
- `app/` – Next.js routes + API agents
- `lib/` – Utilities, logger, AI helpers
- `docs/` – AI_GUIDE.md + architecture
- `.github/workflows/` – CI, Security, Self-Improvement

## Self-Improvement
Daily evolution jobs use Groq to analyze and propose improvements (see `daily-evolution.yml`).

## License
MIT
