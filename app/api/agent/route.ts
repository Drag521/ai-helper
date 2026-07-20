import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'), // Falls back gracefully if no key
      system: `You are an open-source, freedom-focused AI Helper. 
               Maximize user time and autonomy. Use local tools when possible.`,
      prompt: message,
    });

    return Response.json({ response: text, status: "success" });
  } catch (error) {
    return Response.json({ 
      response: "Agent ready. For full features, optional env vars: FIRECRAWL_API_KEY, E2B_API_KEY", 
      status: "limited" 
    });
  }
}
