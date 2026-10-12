import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import { serviceUnavailable } from '../../lib/errors';

const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().max(4000) }))
    .max(12)
    .optional(),
});

const SYSTEM_PROMPT = `You are GramLedger Shetkari Mitra, a careful agriculture and rural-life advisor for people in Maharashtra. Answer in the user's language (Marathi when they write Marathi, otherwise simple English). Give practical, low-cost, locally relevant guidance about crops, soil, irrigation, pests, livestock, weather, markets, government schemes, rural livelihoods, and village services. Prefer official Indian sources and clearly label uncertainty. Never invent a scheme, dosage, price, diagnosis, emergency procedure, or legal entitlement. For pesticide, medical, animal-health, electrical, and financial safety questions, give cautious first aid and tell the user to consult the relevant Krishi Vigyan Kendra, agriculture officer, veterinarian, doctor, or emergency service. Ask one useful follow-up question when location, crop, season, or symptoms are missing. Keep answers structured with short headings and actionable steps.`;

export const advisorRouter = new Hono<AppEnv>();

advisorRouter.post('/advisor/chat', zValidator('json', chatSchema), async (c) => {
  const apiKey = c.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw serviceUnavailable('Agriculture advisor is not configured');

  const { message, history = [] } = c.req.valid('json');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: c.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((item) => ({
          role: item.role === 'model' ? 'assistant' : item.role,
          content: item.text,
        })),
        { role: 'user', content: message },
      ],
      temperature: 0.35,
      max_tokens: 900,
    }),
  });
  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 300);
    console.error('Groq advisor request failed', { status: response.status, body: errorBody });
    if (response.status === 401) {
      throw serviceUnavailable('The Groq API key was rejected. Check apps/api/.dev.vars.');
    }
    if (response.status === 404) {
      throw serviceUnavailable('The configured Groq model or endpoint was not found.');
    }
    throw serviceUnavailable('Agriculture advisor is temporarily unavailable');
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw serviceUnavailable('The advisor returned no answer');
  return c.json({ text });
});
