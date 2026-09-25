import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { getApiOrigin } from "../services/api";

function socketOrigin() {
  try {
    const url = new URL(getApiOrigin());
    return `${url.protocol}//${url.host}`;
  } catch {
    return window.location.origin;
  }
}

function readToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

/**
 * Authenticated socket for the signed-in user. `notification:new` means
 * "refetch" — the payload has no notification body.
 * Reconnects when the session token changes.
 */
export function useNotificationStream(onNotification) {
  const handlerRef = useRef(onNotification);
  handlerRef.current = onNotification;
  const [sessionTick, setSessionTick] = useState(0);

  useEffect(() => {
    const onSession = () => setSessionTick((n) => n + 1);
    window.addEventListener("authSessionUpdated", onSession);
    return () => window.removeEventListener("authSessionUpdated", onSession);
  }, []);

  useEffect(() => {
    const token = readToken();
    if (!token) return undefined;
    const socket = io(socketOrigin(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });
    const onNew = () => {
      handlerRef.current?.();
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
      socket.disconnect();
    };
  }, [sessionTick]);
}
