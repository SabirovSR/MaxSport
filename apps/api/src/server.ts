import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPool } from "@maxsport/shared";
import { createVenueRepository } from "@maxsport/venue";
import { createLobbyService } from "@maxsport/lobby";
import {
  createMaxApiClient,
  createMaxBotAdapter,
} from "@maxsport/max-channel";
import { createChatCardService } from "@maxsport/chat-card";
import { createPresenceService } from "@maxsport/presence";
import { createPaymentService } from "@maxsport/payment";
import { createKarmaService } from "@maxsport/karma";
import { createNotificationScheduler } from "@maxsport/notifications";
import { createRealtimeHub } from "@maxsport/realtime";
import { createGeoService } from "@maxsport/geo";
import { registerApiRoutes } from "./routes.js";
import {
  registerWebhookRoutes,
  registerWebhookSubscription,
} from "./webhook.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const publicUrl = env("PUBLIC_URL", "http://localhost:3000");
  const botToken = process.env.MAX_BOT_TOKEN ?? "";
  const webhookSecret = process.env.WEBHOOK_SECRET ?? "";
  const botUsername = process.env.BOT_USERNAME ?? "gov_max_sport_bot";
  const databaseUrl = env(
    "DATABASE_URL",
    "postgresql://maxsport:maxsport@localhost:5432/maxsport"
  );
  const redisUrl = env("REDIS_URL", "redis://localhost:6379");

  const pool = createPool(databaseUrl);

  const venues = createVenueRepository(pool);
  const lobbies = createLobbyService(pool, venues);
  const maxApi = createMaxApiClient(botToken);
  const bot = createMaxBotAdapter(botToken);
  const chatCard = createChatCardService(
    maxApi,
    lobbies,
    publicUrl,
    botUsername
  );
  const presence = createPresenceService(pool);
  const payments = createPaymentService(pool);
  const karma = createKarmaService(pool);
  const notifications = createNotificationScheduler(pool, maxApi);
  const realtime = createRealtimeHub(redisUrl);
  const geo = createGeoService({
    jsApiKey: process.env.YANDEX_MAPS_JS_API_KEY ?? "",
    suggestKey: process.env.YANDEX_SUGGEST_API_KEY ?? "",
    geocoderKey: process.env.YANDEX_GEOCODER_API_KEY ?? "",
    staticKey: process.env.YANDEX_STATIC_API_KEY ?? "",
  });

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // The Mini App registration owns reply.sendFile, which the SPA fallback at
  // the bottom of this file depends on.
  const miniAppRoot = join(__dirname, "../../mini-app/dist");
  await app.register(fastifyStatic, {
    root: miniAppRoot,
    prefix: "/app/",
  });

  app.get("/app", async (request, reply) => {
    const qs = request.url.includes("?")
      ? request.url.slice(request.url.indexOf("?"))
      : "";
    return reply.redirect(`/app/${qs}`, 308);
  });

  app.get("/healthz", async () => ({ ok: true, service: "maxsport-api" }));

  // The landing is a static build with no access to server env, so its primary
  // call to action points here instead of embedding the bot username. Keeps
  // the deep link correct without a Docker build argument.
  app.get("/open", async (_request, reply) =>
    reply.redirect(`https://max.ru/${botUsername}`, 302)
  );

  // wildcard:false makes @fastify/static enumerate the build at boot and
  // register one route per file, plus "/" for index.html. A catch-all at this
  // prefix would otherwise shadow /api, /app, /webhook and /healthz.
  const landingRoot = join(__dirname, "../../landing/dist");
  if (existsSync(join(landingRoot, "index.html"))) {
    await app.register(fastifyStatic, {
      root: landingRoot,
      prefix: "/",
      decorateReply: false,
      wildcard: false,
    });
  } else {
    app.log.warn(
      { landingRoot },
      "Landing build not found, serving a placeholder at /"
    );
    app.get("/", async (_request, reply) =>
      reply
        .type("text/html")
        .send(
          `<!DOCTYPE html><html lang="ru"><meta charset="utf-8">` +
            `<title>MAX Sport</title><body style="font-family:system-ui;background:#1a1a1a;color:#fafafa;padding:3rem">` +
            `<p>Лендинг не собран. Выполните <code>npm run build</code>.</p>` +
            `<p><a style="color:#c8f54a" href="/app/">Открыть Mini App</a></p>`
        )
    );
  }

  await registerApiRoutes(app, {
    pool,
    botToken,
    botUsername,
    lobbies,
    venues,
    presence,
    payments,
    karma,
    chatCard,
    realtime,
    notifications,
    geo,
  });

  registerWebhookRoutes(app, {
    pool,
    botToken,
    webhookSecret,
    bot,
    lobbies,
    chatCard,
    presence,
    karma,
    realtime,
    publicUrl,
  });

  app.setNotFoundHandler((request, reply) => {
    const path = (request.url.split("?")[0] ?? "").replace(/\/$/, "") || "/";
    if (
      path === "/app" ||
      (path.startsWith("/app/") && !path.startsWith("/app/assets/"))
    ) {
      return reply.sendFile("index.html", miniAppRoot);
    }
    return reply.code(404).send({ error: "Not Found" });
  });

  await app.listen({ port, host: "0.0.0.0" });

  notifications.start();

  if (botToken && webhookSecret && publicUrl.startsWith("https")) {
    try {
      await registerWebhookSubscription({ maxApi, publicUrl, webhookSecret });
      app.log.info("Webhook subscription registered");
    } catch (error) {
      app.log.warn({ err: error }, "Webhook subscription failed");
    }
  }
}

main().catch((error) => {
  console.error("API startup failed:", error);
  process.exit(1);
});
