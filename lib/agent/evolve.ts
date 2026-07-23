import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import "dotenv/config";

const model = groq('llama-3.3-70b-versatile');

export async function evolveSelf(task: string = "Analyze repo health and propose small safe improvements") {
  console.log("🤖 Starting self-evolution...");

  const context = `
Project: AI Helper - self-improving agent.
Current date: ${new Date().toISOString()}
Goal: Make the system more reliable and autonomous with minimal human input.
  `;

  try {
    const { text } = await generateText({
      model,
      prompt: `${context}\n\nTask: ${task}\nRespond ONLY with a short summary and any suggested code changes in diff format if needed.`,
    });

    console.log("🤖 Agent response:\n", text);

    fs.writeFileSync('AGENT_EVOLUTION_LOG.md', `# Evolution Log - ${new Date().toISOString()}\n\n${text}\n\n---\n`, { flag: 'a' });

    return text;
  } catch (error) {
    console.error("❌ Evolution failed:", error);
    return "Error during evolution.";
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  evolveSelf().catch(console.error);
}
