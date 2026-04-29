"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(window.location.origin, {
      path: "/ws/",
      transports: ["websocket"],
      // Stop retrying after 3 failures — Vercel has no Socket.io server
      // so without this cap the browser spams failed WS connections forever.
      reconnectionAttempts: 3,
      timeout: 4000,
    });

    _socket.on("connect_error", () => {
      // Silently ignore — app works fine without Socket.io (WebRTC uses DB polling)
    });
  }
  return _socket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    if (!socket.connected && socket.disconnected) socket.connect();
    return () => {};
  }, []);

  return socketRef;
}
