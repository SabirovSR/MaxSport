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

function senderUserId(ctx: Context): number {
  const user = ctx.user as { user_id?: number } | undefined;
  return user?.user_id ?? ctx.callback?.user?.user_id ?? 0;
}

function isGroupMessage(ctx: Context): boolean {
  const recipient = (
    ctx.message as { recipient?: { chat_type?: string } } | undefined
  )?.recipient;
  return Boolean(recipient?.chat_type && recipient.chat_type !== "dialog");
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

  async function replyToUser(
    ctx: Context,
    text: string,
    extra?: Parameters<Context["api"]["sendMessageToUser"]>[2]
  ) {
    const userId = senderUserId(ctx);
    if (!userId) return;
    // личка в max идёт по user_id; ctx.reply шлёт chat_id и молчит
    await ctx.api.sendMessageToUser(userId, text, extra);
  }

  function bindReplies(ctx: Context) {
    return {
      userId: senderUserId(ctx),
      reply: async (text: string) => {
        await replyToUser(ctx, text);
      },
      replyWithButtons: async (text: string, buttons: BotReplyButton[]) => {
        await replyToUser(ctx, text, {
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
        });
      },
    };
  }

  async function runStart(ctx: Context) {
    const handler = commands.get("start");
    const { userId, reply } = bindReplies(ctx);
    if (handler) {
      await handler({ userId, reply });
      return;
    }
    await reply("MAX Sport — собери состав и не сорви игру!");
  }

  bot.on("bot_started", async (ctx) => {
    await runStart(ctx);
  });

  bot.on("message_created", async (ctx) => {
    if (isGroupMessage(ctx)) return;
    await runStart(ctx);
  });

  bot.on("message_callback", async (ctx) => {
    const payload = ctx.callback?.payload ?? "";
    const prefix = payload.split(":")[0] ?? "";
    const handler = callbacks.get(prefix);
    if (!handler) return;
    const bound = bindReplies(ctx);
    await handler({
      userId: bound.userId,
      payload,
      reply: bound.reply,
      replyWithButtons: bound.replyWithButtons,
    });
    try {
      await ctx.answerOnCallback({});
    } catch {
      // кнопка могла уже закрыться
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
