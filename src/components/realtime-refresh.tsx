"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const WEBSOCKET_PATH = "/api/ws";
const REFRESH_DEBOUNCE_MS = 300;
const RECONNECT_DELAY_MS = 3000;

/**
 * Durable Object の WebSocket（Hibernation API）に接続し、他クライアントや
 * Cron による状態変更を受信したらフォームを即時に再取得する。
 * 通知の中身は使わず「変更があった」事実だけを見て router.refresh() する
 * ため、どのページ（現在設定 / 予約設定）でも同じ挙動でよい。
 */
export function RealtimeRefresh() {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopped = false;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const connect = () => {
      if (stopped) {
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}${WEBSOCKET_PATH}`);

      socket.addEventListener("message", () => {
        scheduleRefresh();
      });

      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => {
        socket?.close();
      });
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimerRef.current) {
        return;
      }
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        socket?.readyState !== WebSocket.OPEN &&
        socket?.readyState !== WebSocket.CONNECTING
      ) {
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      socket?.close();
    };
  }, [router]);

  return null;
}
