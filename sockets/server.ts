import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server } from "socket.io";

declare global {
  var socketServer: Server | undefined;
}

export function initSocketServer(io: Server) {
  globalThis.socketServer = io;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy(times) {
        return times > 3 ? null : Math.min(times * 200, 1_000);
      },
    });
    const subClient = pubClient.duplicate();

    const onRedisError = (error: Error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Socket.IO Redis adapter unavailable: ${error.message}`);
      }
    };

    pubClient.on("error", onRedisError);
    subClient.on("error", onRedisError);

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("Socket.IO Redis adapter enabled");
      })
      .catch((error) => {
        onRedisError(error instanceof Error ? error : new Error("Redis error"));
        pubClient.disconnect();
        subClient.disconnect();
      });
  }

  io.on("connection", (socket) => {
    const organizationId = socket.handshake.auth.organizationId as string | undefined;
    const areaIds = socket.handshake.auth.areaIds as string[] | undefined;

    if (organizationId) {
      socket.join(`org:${organizationId}`);
    }

    areaIds?.forEach((areaId) => socket.join(`area:${areaId}`));

    socket.emit("user:online", { socketId: socket.id });

    socket.on("disconnect", () => {
      socket.broadcast.emit("user:offline", { socketId: socket.id });
    });
  });
}
