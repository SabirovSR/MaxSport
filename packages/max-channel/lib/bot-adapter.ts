import { Bot, Context } from "@maxhub/max-bot-api";

export interface BotReplyButton {
  label: string;
  callbackData: string;
}

export interface MaxBotAdapter {
  handleUpdate(update: unknown): Promise<void>;
  registerCommand(
    command: string,
    handler: (ctx: {
      userId: number;
      reply: (text: string) => Promise<void>;
    }) => Promise<void>
  ): void;
  registerCallback(
    prefix: string,
    handler: (ctx: {
      userId: number;
      payload: string;
      reply: (text: string) => Promise<void>;
      replyWithButtons: (
        text: string,
        buttons: BotReplyButton[]
      ) => Promise<void>;
    }) => Promise<void>
  ): void;
}

export function createMaxBotAdapter(token: string): MaxBotAdapter {
  if (!token) {
    return {
      async handleUpdate() {},
      registerCommand() {},
      registerCallback() {},
    };
  }

  const bot = new Bot(token);
  let botInfoLoaded = false;
  const callbacks = new Map<
    string,
    (ctx: {
      userId: number;
      payload: string;
      reply: (text: string) => Promise<void>;
      replyWithButtons: (
        text: string,
        buttons: BotReplyButton[]
      ) => Promise<void>;
    }) => Promise<void>
  >();
  const commands = new Map<
    string,
    (ctx: {
      userId: number;
      reply: (text: string) => Promise<void>;
    }) => Promise<void>
  >();

  bot.catch((err: unknown) => {
    console.error("MAX bot error", err);
  });

  bot.command("start", async (ctx) => {
    const handler = commands.get("start");
    const userId = (ctx.user as { user_id?: number } | undefined)?.user_id ?? 0;
    if (handler) {
      await handler({
        userId,
        reply: async (text) => {
          await ctx.reply(text);
        },
      });
    } else {
      await ctx.reply("MAX Sport — собери состав и не сорви игру!");
    }
  });

  bot.on("message_callback", async (ctx) => {
    const payload = ctx.callback?.payload ?? "";
    const prefix = payload.split(":")[0] ?? "";
    const handler = callbacks.get(prefix);
    if (!handler) return;
    const userId = ctx.callback?.user?.user_id ?? ctx.user?.user_id ?? 0;
    await handler({
      userId,
      payload,
      reply: async (text) => {
        await ctx.reply(text);
      },
      replyWithButtons: async (text, buttons) => {
        await ctx.reply({
          text,
          attachments: [
            {
              type: "inline_keyboard",
              payload: {
                buttons: buttons.map((btn) => [
                  {
                    type: "callback",
                    text: btn.label,
                    payload: btn.callbackData,
                  },
                ]),
              },
            },
          ],
        } as never);
      },
    });
  });

  bot.on("bot_started", async (ctx) => {
    const handler = commands.get("start");
    const userId = (ctx.user as { user_id?: number } | undefined)?.user_id ?? 0;
    if (handler) {
      await handler({
        userId,
        reply: async (text) => {
          await ctx.reply(text);
        },
      });
    }
  });

  async function dispatchUpdate(update: unknown) {
    if (!botInfoLoaded) {
      bot.botInfo = await bot.api.getMyInfo();
      botInfoLoaded = true;
    }
    const ctx = new Context(update as never, bot.api, bot.botInfo);
    await bot.middleware()(ctx, () => Promise.resolve(undefined));
  }

  return {
    handleUpdate: dispatchUpdate,
    registerCommand(command, handler) {
      commands.set(command, handler);
    },
    registerCallback(prefix, handler) {
      callbacks.set(prefix, handler);
    },
  };
}
