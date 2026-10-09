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
  const apiKey = c.env.GEMINI_API_KEY;
  if (!apiKey) throw serviceUnavailable('Agriculture advisor is not configured');

  const { message, history = [] } = c.req.valid('json');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          ...history.map((item) => ({ role: item.role, parts: [{ text: item.text }] })),
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
      }),
    },
  );
  if (!response.ok) throw serviceUnavailable('Agriculture advisor is temporarily unavailable');
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) throw serviceUnavailable('The advisor returned no answer');
  return c.json({ text });
});
