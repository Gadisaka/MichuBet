import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getRedisClient } from "../services/cacheService.js";

const CHANNEL = "sportsbook:market-events";
const USER_CHANNEL = "sportsbook:user-events";
let ioInstance = null;
let subscriber = null;

export function userRoom(userId) {
  return `user:${userId}`;
}

export function buildUserEvent(userId, event, data) {
  return { userId, event, data: data ?? {} };
}

export async function publishMarketEvent(event) {
  try {
    const redis = getRedisClient();
    await redis.publish(CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.error("publishMarketEvent error:", error?.message || error);
  }
}

function emitUserEvent(userId, event, data) {
  const io = getSocketHub();
  if (!io) return;
  io.to(userRoom(userId)).emit(event, data ?? {});
}

/** Room-scoped user event. Never throws — callers fire this and continue. */
export async function publishUserEvent({ userId, event, data }) {
  if (!userId || !event) return;
  const payload = data ?? {};
  try {
    emitUserEvent(userId, event, payload);
  } catch (error) {
    console.error("publishUserEvent local error:", error?.message || error);
  }
  try {
    const redis = getRedisClient();
    await redis.publish(
      USER_CHANNEL,
      JSON.stringify(buildUserEvent(userId, event, payload)),
    );
  } catch (error) {
    console.error("publishUserEvent error:", error?.message || error);
  }
}

function dispatchMarketEvent(io, message) {
  try {
    const payload = JSON.parse(message);
    const fixtureId = Number.parseInt(payload?.apiFixtureId, 10);
    const eventName = payload?.event || "market:event";
    if (Number.isFinite(fixtureId)) {
      io.emit(eventName, payload);
      io.to(`fixture:${fixtureId}`).emit(eventName, payload);
    } else {
      io.emit(eventName, payload);
    }
  } catch {
    // ignore malformed payload
  }
}

function dispatchUserEvent(io, message) {
  try {
    const payload = JSON.parse(message);
    const userId = payload?.userId;
    const event = payload?.event;
    if (!userId || !event) return;
    io.to(userRoom(userId)).emit(event, payload.data ?? {});
  } catch {
    // ignore malformed payload
  }
}

export async function initSocketHub(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = payload?.sub ?? null;
    } catch {
      // Odds sockets stay anonymous. A bad token must not drop the connection.
      socket.data.userId = null;
    }
    return next();
  });
  io.on("connection", (socket) => {
    if (socket.data.userId) socket.join(userRoom(socket.data.userId));
    socket.on("fixture:subscribe", (apiFixtureId) => {
      const id = Number.parseInt(apiFixtureId, 10);
      if (Number.isFinite(id)) socket.join(`fixture:${id}`);
    });
    socket.on("fixture:unsubscribe", (apiFixtureId) => {
      const id = Number.parseInt(apiFixtureId, 10);
      if (Number.isFinite(id)) socket.leave(`fixture:${id}`);
    });
  });
  ioInstance = io;

  try {
    const base = getRedisClient();
    subscriber = base.duplicate();
    await subscriber.connect();
    // ioredis delivers pub/sub payloads on "message". A function passed to
    // subscribe() is only the command callback, not the payload listener.
    subscriber.on("message", (channel, message) => {
      if (channel === USER_CHANNEL) dispatchUserEvent(io, message);
      else if (channel === CHANNEL) dispatchMarketEvent(io, message);
    });
    await subscriber.subscribe(CHANNEL, USER_CHANNEL);
  } catch (error) {
    console.error("initSocketHub subscribe error:", error?.message || error);
  }
}

export function getSocketHub() {
  return ioInstance;
}

