import { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface RealtimeHub {
  publishLobbyUpdate(lobbyId: string, payload: unknown): Promise<void>;
  subscribeLobby(
    lobbyId: string,
    listener: (payload: unknown) => void
  ): () => void;
  close(): Promise<void>;
}

export function createRealtimeHub(redisUrl: string): RealtimeHub {
  const pub = new Redis(redisUrl);
  const sub = new Redis(redisUrl);
  const local = new EventEmitter();

  const logRedisError = (role: string) => (error: Error) => {
    console.error(`Redis ${role} error`, error);
  };
  pub.on("error", logRedisError("pub"));
  sub.on("error", logRedisError("sub"));

  sub.on("message", (channel: string, message: string) => {
    try {
      local.emit(channel, JSON.parse(message));
    } catch {
      local.emit(channel, message);
    }
  });

  return {
    async publishLobbyUpdate(lobbyId, payload) {
      const channel = `lobby:${lobbyId}`;
      const body = JSON.stringify(payload);
      await pub.publish(channel, body);
      local.emit(channel, payload);
    },

    subscribeLobby(lobbyId, listener) {
      const channel = `lobby:${lobbyId}`;
      void sub.subscribe(channel);
      local.on(channel, listener);
      return () => {
        local.off(channel, listener);
      };
    },

    async close() {
      await pub.quit();
      await sub.quit();
    },
  };
}
