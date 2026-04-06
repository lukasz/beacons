import { useEffect, useRef, useCallback } from 'react';

type MessageHandler = (type: string, payload: unknown) => void;

export function useSync(
  roomId: string | null,
  userId: string,
  userName: string,
  onMessage: MessageHandler,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomId) return;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectDelay = 1000;
    let alive = true;

    function connect() {
      if (!alive) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${proto}//${window.location.host}/ws/${roomId}?name=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay = 1000;
      };

      ws.onmessage = (ev) => {
        const lines = (ev.data as string).split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            onMessageRef.current(msg.type, msg.payload);
          } catch {
            // ignore
          }
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        reconnectTimeout = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 10000);
          connect();
        }, reconnectDelay);
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [roomId, userId, userName]);

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { send };
}
