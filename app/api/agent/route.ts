import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile') as any,
      system: 'You are an autonomous, self-improving AI Helper dedicated to freedom and efficiency. Analyze, propose real code changes, and help the platform evolve.',
      prompt: `Current repo context: Next.js AI platform. User request: ${message}`,
    });

    return Response.json({ response: text, status: 'success' });
  } catch {
    return Response.json({ response: 'Agent online. Add GROQ_API_KEY for full power.', status: 'limited' });
  }
}
