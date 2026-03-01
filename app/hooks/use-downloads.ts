import { useCallback, useState } from 'react';
import { apiFetch } from '~/lib/api';
import type { DownloadItem, WsMessage } from '~/lib/types';
import { useWebSocket } from './use-websocket';

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  const handleWsMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'downloads':
        setDownloads(msg.downloads);
        break;
      case 'progress':
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === msg.downloadId ? { ...d, progress: msg.progress, status: 'downloading' } : d,
          ),
        );
        break;
    }
  }, []);

  const { connected } = useWebSocket({ onMessage: handleWsMessage });

  const startDownload = useCallback(
    async (opts: {
      url: string;
      formatId: string;
      title: string;
      thumbnail: string | null;
      ext: string;
    }) => {
      const result = await apiFetch<{ id: string }>('/api/download', {
        method: 'POST',
        body: opts,
      });
      return result.id;
    },
    [],
  );

  const cancelDownload = useCallback(async (id: string) => {
    await apiFetch(`/api/download/${id}`, { method: 'DELETE' });
  }, []);

  const clearCompleted = useCallback(async () => {
    await apiFetch('/api/downloads/completed', { method: 'DELETE' });
    setDownloads((prev) =>
      prev.filter(
        (d) => d.status !== 'completed' && d.status !== 'failed' && d.status !== 'cancelled',
      ),
    );
  }, []);

  return { downloads, connected, startDownload, cancelDownload, clearCompleted };
}
