const MAX_API_BASE = "https://platform-api2.max.ru";

export interface InlineButton {
  type: "callback" | "link" | "open_app";
  text: string;
  payload?: string;
  url?: string;
}

export interface SendMessageInput {
  chatId?: number;
  userId?: number;
  text: string;
  buttons?: InlineButton[][];
  format?: "markdown" | "html";
}

export interface MaxApiClient {
  sendMessage(input: SendMessageInput): Promise<{ messageId: string }>;
  editMessage(
    messageId: string,
    input: Omit<SendMessageInput, "chatId" | "userId">
  ): Promise<void>;
  subscribeWebhook(url: string, secret: string): Promise<void>;
}

function buildKeyboard(buttons?: InlineButton[][]) {
  if (!buttons?.length) return undefined;
  return {
    type: "inline_keyboard",
    payload: {
      buttons: buttons.map((row) =>
        row.map((btn) => {
          if (btn.type === "callback") {
            return { type: "callback", text: btn.text, payload: btn.payload };
          }
          if (btn.type === "open_app") {
            return { type: "open_app", text: btn.text, url: btn.url };
          }
          return { type: "link", text: btn.text, url: btn.url };
        })
      ),
    },
  };
}

async function maxFetch(
  token: string,
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string> }
): Promise<Response> {
  const url = new URL(`${MAX_API_BASE}${path}`);
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const { searchParams: _sp, ...rest } = init ?? {};
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
}

export function createMaxApiClient(token: string): MaxApiClient {
  return {
    async sendMessage(input) {
      const searchParams: Record<string, string> = {};
      if (input.chatId) searchParams.chat_id = String(input.chatId);
      if (input.userId) searchParams.user_id = String(input.userId);

      const attachments = [];
      const keyboard = buildKeyboard(input.buttons);
      if (keyboard) attachments.push(keyboard);

      const response = await maxFetch(token, "/messages", {
        method: "POST",
        searchParams,
        body: JSON.stringify({
          text: input.text,
          format: input.format,
          attachments: attachments.length ? attachments : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`MAX sendMessage failed: ${response.status} ${body}`);
      }

      const data = (await response.json()) as {
        message?: { body?: { mid?: string }; message_id?: string };
      };
      const messageId =
        data.message?.body?.mid ??
        data.message?.message_id ??
        String(Date.now());
      return { messageId };
    },

    async editMessage(messageId, input) {
      const attachments = [];
      const keyboard = buildKeyboard(input.buttons);
      if (keyboard) attachments.push(keyboard);

      const response = await maxFetch(token, "/messages", {
        method: "PUT",
        searchParams: { message_id: messageId },
        body: JSON.stringify({
          text: input.text,
          format: input.format,
          attachments: attachments.length ? attachments : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`MAX editMessage failed: ${response.status} ${body}`);
      }
    },

    async subscribeWebhook(url, secret) {
      const response = await maxFetch(token, "/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          url,
          secret,
          update_types: [
            "bot_started",
            "message_created",
            "message_callback",
            "bot_added",
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `MAX subscribeWebhook failed: ${response.status} ${body}`
        );
      }
    },
  };
}
