/**
 * usePrintQueueSSE Hook
 *
 * Manages SSE connection to the print queue for real-time updates.
 * Handles connection, reconnection, and event processing.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { useAuthStore } from '../stores/authStore';
import type { PrintQueueItem } from '../services/printQueueService';

export type PrintQueueEventType =
  | 'connected'
  | 'initial'
  | 'new_sale'
  | 'item_updated'
  | 'heartbeat'
  | 'error'
  | 'reconnecting';

export interface PrintQueueEvent {
  type: PrintQueueEventType;
  data?: unknown;
}

export interface ConnectedEvent extends PrintQueueEvent {
  type: 'connected';
  data: { userId: string };
}

export interface InitialEvent extends PrintQueueEvent {
  type: 'initial';
  data: Partial<PrintQueueItem>[];
}

export interface NewSaleEvent extends PrintQueueEvent {
  type: 'new_sale';
  data: Partial<PrintQueueItem>;
}

export interface ItemUpdatedEvent extends PrintQueueEvent {
  type: 'item_updated';
  data: { id: string; status: string; error?: string };
}

export interface HeartbeatEvent extends PrintQueueEvent {
  type: 'heartbeat';
  data: { timestamp: number };
}

export interface ErrorEvent extends PrintQueueEvent {
  type: 'error';
  data: { message: string };
}

export interface ReconnectingEvent extends PrintQueueEvent {
  type: 'reconnecting';
  data: { attempt: number };
}

interface UsePrintQueueSSEOptions {
  enabled?: boolean;
  onEvent?: (event: PrintQueueEvent) => void;
  onNewSale?: (item: Partial<PrintQueueItem>) => void;
  onItemUpdated?: (itemId: string, status: string) => void;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export function usePrintQueueSSE(options: UsePrintQueueSSEOptions = {}) {
  const {
    enabled = true,
    onEvent,
    onNewSale,
    onItemUpdated,
    maxReconnectAttempts = 10,
    reconnectDelay = 3000,
  } = options;

  const apiUrl = useConfigStore((state) => state.apiUrl);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef(false);

  const processEvent = useCallback((eventType: string, data: unknown) => {
    setLastEventTime(new Date());

    let event: PrintQueueEvent;

    switch (eventType) {
      case 'connected':
        event = { type: 'connected', data: data as { userId: string } };
        break;
      case 'print_queue:initial':
        event = { type: 'initial', data: data as Partial<PrintQueueItem>[] };
        break;
      case 'print_queue:new_sale':
        event = { type: 'new_sale', data: data as Partial<PrintQueueItem> };
        onNewSale?.(data as Partial<PrintQueueItem>);
        break;
      case 'print_queue:item_updated': {
        const updateData = data as { id: string; status: string; error?: string };
        event = { type: 'item_updated', data: updateData };
        onItemUpdated?.(updateData.id, updateData.status);
        break;
      }
      case 'print_queue:heartbeat':
        event = { type: 'heartbeat', data: data as { timestamp: number } };
        break;
      default:
        console.log('SSE: Unknown event type:', eventType, data);
        return;
    }

    onEvent?.(event);
  }, [onEvent, onNewSale, onItemUpdated]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('SSE: Max reconnect attempts reached');
      setConnectionError('Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    reconnectAttemptRef.current++;
    const attempt = reconnectAttemptRef.current;

    onEvent?.({ type: 'reconnecting', data: { attempt } });

    // Exponential backoff with max 30 seconds
    const delay = Math.min(reconnectDelay * Math.pow(2, attempt - 1), 30000);

    console.log(`SSE: Reconnecting in ${delay}ms (attempt ${attempt})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      // Will trigger reconnect via effect
      setIsConnected(false);
    }, delay);
  }, [maxReconnectAttempts, reconnectDelay, onEvent]);

  const connect = useCallback(async () => {
    if (!enabled || !isAuthenticated || !token || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Abort previous connection if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    const url = `${apiUrl}/api/v1/global/print-queue/subscribe`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptRef.current = 0;
      isConnectingRef.current = false;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete events (ending with \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventText of events) {
          if (!eventText.trim()) continue;

          const lines = eventText.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (eventData) {
            try {
              const data = JSON.parse(eventData);
              processEvent(eventType, data);
            } catch (e) {
              console.error('SSE: Failed to parse event data:', e);
            }
          }
        }
      }

      // Connection closed normally
      setIsConnected(false);
      isConnectingRef.current = false;
      scheduleReconnect();

    } catch (error) {
      isConnectingRef.current = false;

      if (error instanceof Error && error.name === 'AbortError') {
        // Intentional abort, don't reconnect
        console.log('SSE: Connection aborted');
        return;
      }

      console.error('SSE connection error:', error);
      setIsConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      scheduleReconnect();
    }
  }, [enabled, isAuthenticated, token, apiUrl, processEvent, scheduleReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    reconnectAttemptRef.current = 0;
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptRef.current = 0;
    connect();
  }, [disconnect, connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled && isAuthenticated && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, isAuthenticated, token, connect, disconnect]);

  // Handle visibility changes (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden, disconnect to save resources
        disconnect();
      } else if (enabled && isAuthenticated) {
        // Tab visible, reconnect
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isAuthenticated, disconnect, reconnect]);

  return {
    isConnected,
    connectionError,
    lastEventTime,
    reconnect,
    disconnect,
  };
}
