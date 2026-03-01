import { Hono } from 'hono';
import { z } from 'zod';
import type { DownloadManager } from './download-manager';
import { extractMetadata } from './ytdlp';

const extractSchema = z.object({
  url: z.url(),
});

const downloadSchema = z.object({
  url: z.url(),
  formatId: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string().nullable().optional(),
  ext: z.string().min(1).default('mp4'),
});

export function createRoutes(manager: DownloadManager): Hono {
  const api = new Hono();

  // Extract video metadata from a URL
  api.post('/extract', async (c) => {
    const body = await c.req.json();
    const parsed = extractSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid URL.' }, 400);
    }
    try {
      const metadata = await extractMetadata(parsed.data.url);
      return c.json({ metadata });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed.';
      return c.json({ error: message }, 500);
    }
  });

  // Start a download
  api.post('/download', async (c) => {
    const body = await c.req.json();
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid download request.' }, 400);
    }
    const id = manager.add(
      parsed.data.url,
      parsed.data.formatId,
      parsed.data.title,
      parsed.data.thumbnail ?? null,
      parsed.data.ext,
    );
    return c.json({ id }, 201);
  });

  // Cancel a download
  api.delete('/download/:id', (c) => {
    const id = c.req.param('id');
    const success = manager.cancel(id);
    if (!success) return c.json({ error: 'Download not found.' }, 404);
    return c.json({ status: 'cancelled' });
  });

  // List all downloads
  api.get('/downloads', (c) => {
    return c.json({ downloads: manager.getAll() });
  });

  // Clear completed/failed/cancelled
  api.delete('/downloads/completed', (c) => {
    manager.clearCompleted();
    return c.json({ status: 'ok' });
  });

  return api;
}
