import type { Alert, NtfySettings } from './alert.js';

export function createNtfyChannel(settings: NtfySettings) {
  const endpoint = `${settings.server.replace(/\/$/, '')}/${settings.topic}`;

  return {
    name: 'ntfy',
    async send(alert: Alert): Promise<void> {
      const headers: Record<string, string> = {
        Title: 'Torn',
        Priority: 'high',
        Click: alert.url,
        Actions: `view, ${alert.buttonLabel}, ${alert.url}`,
      };
      if (settings.token) {
        headers.Authorization = `Bearer ${settings.token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: alert.text,
      });

      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(
          detail === ''
            ? `ntfy responded ${response.status}`
            : `ntfy responded ${response.status}: ${detail}`,
        );
      }

      await response.text();
    },
  };
}
