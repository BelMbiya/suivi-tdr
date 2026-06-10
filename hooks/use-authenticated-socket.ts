"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/lib/http";
import type { CurrentUser } from "@/types/domain";

export const REALTIME_POLL_MS = 5_000;
const DISCONNECTED_POLL_MS = 3_000;

export function useAuthenticatedSocket(enabled: boolean) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    let activeSocket: Socket | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const user = await api<CurrentUser>("/api/auth/me");
        if (cancelled) {
          return;
        }

        activeSocket = io(window.location.origin, {
          auth: {
            organizationId: user.organizationId,
            areaIds: user.areaIds,
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1_000,
          reconnectionDelayMax: 5_000,
        });

        activeSocket.on("connect", () => setIsConnected(true));
        activeSocket.on("disconnect", () => setIsConnected(false));
        activeSocket.on("connect_error", () => setIsConnected(false));

        setSocket(activeSocket);
      } catch (error) {
        console.error("Socket connection failed", error);
        setIsConnected(false);
      }
    }

    connect();

    return () => {
      cancelled = true;
      activeSocket?.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [enabled]);

  return { socket, isConnected };
}

export function realtimePollInterval(isConnected: boolean) {
  return isConnected ? REALTIME_POLL_MS : DISCONNECTED_POLL_MS;
}

export function realtimePollLabel(isConnected: boolean) {
  const seconds = realtimePollInterval(isConnected) / 1000;
  return isConnected
    ? `Temps réel actif (WebSocket + synchro toutes les ${seconds} s)`
    : `WebSocket déconnecté — synchro toutes les ${seconds} s`;
}
