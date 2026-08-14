import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
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

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const staticRoot = join(__dirname, "../../mini-app/dist");
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: "/app/",
    decorateReply: false,
  });

  app.get("/app", async (request, reply) => {
    const qs = request.url.includes("?")
      ? request.url.slice(request.url.indexOf("?"))
      : "";
    return reply.redirect(`/app/${qs}`, 308);
  });

  app.get("/healthz", async () => ({ ok: true, service: "maxsport-api" }));

  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>MAX Sport</title>
  <style>
    :root { --charcoal:#1A1A1A; --lime:#C8F54A; --white:#fff; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: system-ui, sans-serif; background:var(--charcoal); color:var(--white); min-height:100vh; }
    main { max-width:720px; margin:0 auto; padding:4rem 1.5rem; }
    .mark { width:64px; height:64px; border:2px solid var(--white); border-radius:12px; display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:8px; margin-bottom:2rem; }
    .mark span { background:#333; border-radius:4px; }
    .mark span.on { background:var(--lime); }
    h1 { font-size:2.5rem; letter-spacing:-0.02em; margin-bottom:0.5rem; }
    h1 em { font-style:normal; border-bottom:2px solid var(--lime); }
    p { color:#aaa; line-height:1.6; margin:1rem 0 2rem; max-width:48ch; }
    a.btn { display:inline-block; background:var(--lime); color:var(--charcoal); text-decoration:none; padding:0.875rem 1.5rem; border-radius:999px; font-weight:600; }
    .tag { margin-top:3rem; font-size:2rem; color:var(--lime); opacity:0.9; }
  </style>
</head>
<body>
  <main>
    <div class="mark"><span class="on"></span><span></span><span></span><span></span><span></span><span></span></div>
    <h1>MAX <em>Sport</em></h1>
    <p>Любительский спорт в MAX: слоты с амплуа, живая карточка в чат, сплит аренды и отметка о явке. Собери состав и не сорви игру.</p>
    <a class="btn" href="https://max.ru/${botUsername}">Открыть в MAX</a>
    <div class="tag">Fill the slot.</div>
  </main>
</body>
</html>`);
  });

  await registerApiRoutes(app, {
    pool,
    botToken,
    lobbies,
    venues,
    presence,
    payments,
    karma,
    chatCard,
    realtime,
    notifications,
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
      return reply.sendFile("index.html", staticRoot);
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
