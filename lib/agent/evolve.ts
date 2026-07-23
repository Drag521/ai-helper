// lib/agent/evolve.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";

type EvolutionPlan = {
  summary: string;
  filesToChange: Array<{
    path: string;
    reason: string;
  }>;
  changes: Array<{
    path: string; // exact file path in repo
    patch?: string; // unified diff (optional if you use "content")
    content?: string; // full file content (optional if you use "patch")
    reason: string;
  }>;
  verificationSteps: string[];
  safetyNotes?: string[];
};

function repoRoot() {
  // repoRoot = directory containing package.json (walk up)
  let dir = process.cwd();
  const { root } = path.parse(dir);
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function safeRead(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function safeStat(filePath: string) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function formatTreeLines(root: string, relDir = ""): string[] {
  const absDir = path.join(root, relDir);
  const st = safeStat(absDir);
  if (!st || !st.isDirectory()) return [];

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const lines: string[] = [];

  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === ".next") continue;
    const rel = path.join(relDir, e.name);
    if (e.isDirectory()) {
      lines.push(`dir: ${rel}`);
    } else {
      lines.push(`file: ${rel}`);
    }
  }
  return lines;
}

function loadMinimalContext(root: string) {
  const packageJson = safeRead(path.join(root, "package.json")) ?? "(missing package.json)";
  const tsconfig = safeRead(path.join(root, "tsconfig.json")) ?? "(missing tsconfig.json)";
  const readme = safeRead(path.join(root, "README.md")) ?? "(missing README.md)";

  // Agent-related folders
  const libAgentDir = path.join(root, "lib", "agent");
  const libDirTree = formatTreeLines(root, "lib");

  // Read a few likely relevant files if they exist
  const evolveFile = safeRead(path.join(root, "lib", "agent", "evolve.ts")) ?? "(missing lib/agent/evolve.ts)";
  const exampleFiles: string[] = [
    path.join(root, "lib", "agent", "evolve.ts"),
    path.join(root, "lib", "agent", "index.ts"),
    path.join(root, "lib", "agent", "tools.ts"),
    path.join(root, "lib", "ai", "client.ts"),
    path.join(root, "lib", "ai", "index.ts"),
  ];

  const existingExampleSnippets = exampleFiles
    .map((p) => {
      const s = safeRead(p);
      if (!s) return null;
      return `---\n${path.relative(root, p)}:\n${s}`;
    })
    .filter(Boolean)
    .join("\n");

  return {
    packageJson,
    tsconfig,
    readme,
    libDirTree: libDirTree.join("\n"),
    // keep evolve.ts small to avoid recursion; still useful as part of context
    evolveFile: evolveFile.length > 8000 ? evolveFile.slice(0, 8000) + "\n/* truncated */" : evolveFile,
    agentSnippets: existingExampleSnippets || "(no additional agent snippets found)",
  };
}

function ensureLogDir(root: string) {
  const p = path.join(root, "logs");
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
}

function writeEvolutionLog(root: string, content: string) {
  const logDir = ensureLogDir(root);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const hash = crypto.randomBytes(6).toString("hex");
  const file = path.join(logDir, `AGENT_EVOLUTION_LOG-${stamp}-${hash}.md`);
  fs.writeFileSync(file, content, "utf8");
  return file;
}

function extractJson(text: string): string | null {
  // Attempt to find the first JSON object/array in the text.
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  return null;
}

function validatePlan(plan: any): plan is EvolutionPlan {
  if (!plan || typeof plan !== "object") return false;
  if (typeof plan.summary !== "string") return false;
  if (!Array.isArray(plan.filesToChange)) return false;
  for (const f of plan.filesToChange) {
    if (!f || typeof f !== "object") return false;
    if (typeof f.path !== "string") return false;
    if (typeof f.reason !== "string") return false;
  }
  if (!Array.isArray(plan.changes)) return false;
  for (const c of plan.changes) {
    if (!c || typeof c !== "object") return false;
    if (typeof c.path !== "string") return false;
    if (typeof c.reason !== "string") return false;
    const hasPatch = typeof c.patch === "string";
    const hasContent = typeof c.content === "string";
    if (!hasPatch && !hasContent) return false;
  }
  if (!Array.isArray(plan.verificationSteps)) return false;
  if (!plan.verificationSteps.every((s: any) => typeof s === "string")) return false;
  return true;
}

// Apply mode OFF by default for safety.
// Set APPLY_EVOLUTION_PATCHES=1 to try applying.
const APPLY = process.env.APPLY_EVOLUTION_PATCHES === "1";

function applyChanges(root: string, plan: EvolutionPlan) {
  const changed: string[] = [];
  for (const ch of plan.changes) {
    const abs = path.join(root, ch.path);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ONLY do safe writes with "content" in this implementation.
    // Unified diff application is intentionally not implemented to avoid wrong parsing.
    if (typeof ch.content === "string") {
      fs.writeFileSync(abs, ch.content, "utf8");
      changed.push(ch.path);
    } else {
      // If patch is provided but content isn't, we do nothing unless you implement patch application.
      // This keeps it safe.
    }
  }
  return changed;
}

async function evolveSelf() {
  const root = repoRoot();
  const evolveTask =
    "Improve repo reliability and autonomy. Focus on: (1) automated testing, (2) error handling + logging, (3) ensure changes are valid TypeScript/Node for this repo, and (4) do not introduce other runtimes (no Python).";

  const ctx = loadMinimalContext(root);

  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      filesToChange: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            reason: { type: "string" },
          },
          required: ["path", "reason"],
          additionalProperties: false,
        },
      },
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            patch: { type: "string" },
            content: { type: "string" },
            reason: { type: "string" },
          },
          required: ["path", "reason"],
          additionalProperties: false,
        },
      },
      verificationSteps: { type: "array", items: { type: "string" } },
      safetyNotes: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "filesToChange", "changes", "verificationSteps"],
    additionalProperties: false,
  };

  const model = groq("llama-3.3-70b-versatile");

  console.log("🤖 Starting self-evolution...");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in .env");

  // Provide explicit instruction: JSON ONLY (no diff outside JSON).
  const prompt = `
You are a codebase maintainer assistant.

Return ONLY valid JSON that matches this schema:
${JSON.stringify(schema, null, 2)}

Rules:
- All suggested changes must be valid TypeScript/Node for THIS repository. No Python.
- Only modify files that either already exist in the repo or are obviously new test files inside the repo (use paths under lib/, tests/, or src/).
- If you include "patch", also include correct "content" or omit patch entirely; prefer "content" so the automation can apply safely.
- Do not add new dependencies unless absolutely necessary; if you do, explain in safetyNotes and include verificationSteps.
- Keep changes minimal and focused.
- verificationSteps must include the exact commands to run (e.g., pnpm test, pnpm lint) based on the repo context.

Repo context:
${JSON.stringify(ctx, null, 2)}

Task:
${evolveTask}
`.trim();

  const result = await generateText({
    model,
    prompt,
    // NOTE: AI SDK v5 supports "responseFormat" in many configurations, but this code stays robust
    // by forcing JSON-only at the prompt level + validating the parsed result.
  });

  const raw = (result.text ?? "").trim();
  const jsonText = extractJson(raw);
  if (!jsonText) {
    throw new Error("Model did not return a JSON object.");
  }

  const parsed = JSON.parse(jsonText);
  if (!validatePlan(parsed)) {
    throw new Error("Returned JSON did not match the expected plan schema.");
  }

  const plan = parsed as EvolutionPlan;

  const logHeader = `# Agent Evolution Log\n\nDate: ${new Date().toISOString()}\n\nAPPLY_EVOLUTION_PATCHES=${process.env.APPLY_EVOLUTION_PATCHES ?? "0"}\n\nModel: llama-3.3-70b-versatile\n\n## Summary\n${plan.summary}\n\n## Files to change\n${plan.filesToChange
    .map((f) => `- ${f.path}: ${f.reason}`)
    .join("\n")}\n\n## Suggested changes\n${plan.changes
      .map((c) => `- ${c.path} (${c.reason})${c.content ? `\n  content: [provided, length=${c.content.length}]` : ""}${c.patch ? `\n  patch: [provided, length=${c.patch.length}]` : ""}`)
      .join("\n")}\n\n## Verification steps\n${plan.verificationSteps.map((s) => `- ${s}`).join("\n")}\n\n## Raw model output\n\`\`\`\n${raw.slice(0, 12000)}${raw.length > 12000 ? "\n/* truncated */" : ""}\n\`\`\`\n`;

  const logPath = writeEvolutionLog(root, logHeader);
  console.log(`🤖 Agent response plan written to: ${logPath}`);

  if (APPLY) {
    const changed = applyChanges(root, plan);
    console.log(`✅ Applied ${changed.length} file(s) with full content writes.`);
    if (changed.length) console.log("Changed files:", changed.join(", "));
  } else {
    console.log("ℹ️ APPLY_EVOLUTION_PATCHES is not enabled; no files were modified.");
  }
}

evolveSelf().catch((err) => {
  console.error("❌ Evolution failed:", err);
  process.exit(1);
});

