"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Module-level singleton — one socket per browser session, shared across components
let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(window.location.origin, { path: "/ws/", transports: ["websocket"] });
  }
  return _socket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    return () => {
      // Do NOT disconnect on unmount — other components may still use the singleton
    };
  }, []);

  return socketRef;
}
