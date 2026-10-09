import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import { serviceUnavailable } from '../../lib/errors';

const querySchema = z.object({ q: z.string().trim().min(1).max(100) });
export const videosRouter = new Hono<AppEnv>();

videosRouter.get('/videos', zValidator('query', querySchema), async (c) => {
  const apiKey = c.env.YOUTUBE_API_KEY;
  if (!apiKey) throw serviceUnavailable('Video search is not configured');
  const query = `${c.req.valid('query').q} agriculture farmer Maharashtra Marathi Hindi`;
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '12');
  url.searchParams.set('safeSearch', 'strict');
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) throw serviceUnavailable('Video search is temporarily unavailable');
  const payload = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        thumbnails?: { medium?: { url?: string } };
        channelTitle?: string;
      };
    }>;
  };
  return c.json(
    (payload.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: item.id!.videoId,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? '',
        channel: item.snippet?.channelTitle ?? '',
      })),
  );
});
