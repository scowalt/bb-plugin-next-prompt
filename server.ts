import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { rpcContract } from "./contract.ts";
import { DEFAULT_MODEL, complete, readOpencodeGoKey } from "./opencode-go.ts";
import { buildMessages, entryText, parseSuggestion } from "./suggest.ts";

const REQUEST_TIMEOUT_MS = 20_000;
const RECENT_USER_MESSAGES = 3;
const SIGNAL = "suggestion-changed";

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    enabled: {
      type: "boolean",
      label: "Suggest next prompts",
      description: "Write a suggested next message after each agent turn.",
      default: true,
    },
    model: {
      type: "string",
      label: "Model",
      description:
        "OpenCode Go model id, such as glm-5.3-flash or deepseek-v4.1-flash.",
      default: DEFAULT_MODEL,
    },
  });

  const suggestions = new Map<string, string>();
  const inFlight = new Map<string, AbortController>();
  const deps = { fetch: globalThis.fetch, readKey: () => readOpencodeGoKey() };

  function forget(threadId: string) {
    inFlight.get(threadId)?.abort();
    inFlight.delete(threadId);
    if (suggestions.delete(threadId)) {
      bb.realtime.publish(SIGNAL, { threadId });
    }
  }

  async function userMessages(threadId: string): Promise<string[]> {
    const entries = await bb.sdk.threads.promptHistory({
      threadId,
      limit: String(RECENT_USER_MESSAGES),
    });
    return [...entries]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((entry) => entryText(entry.input))
      .filter((text) => text.length > 0)
      .slice(-RECENT_USER_MESSAGES);
  }

  async function suggest(
    threadId: string,
    title: string | null,
    assistantText: string,
  ) {
    const controller = new AbortController();
    inFlight.set(threadId, controller);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const config = await settings.get();
      const model = config.model.trim() || DEFAULT_MODEL;
      const raw = await complete(
        deps,
        model,
        buildMessages({
          title,
          userMessages: await userMessages(threadId),
          assistantText,
        }),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const text = parseSuggestion(raw);
      if (text === null) return;
      suggestions.set(threadId, text);
      bb.realtime.publish(SIGNAL, { threadId });
    } catch (error) {
      if (!controller.signal.aborted) {
        bb.log.warn(
          `suggestion for ${threadId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
      if (inFlight.get(threadId) === controller) inFlight.delete(threadId);
    }
  }

  bb.events.on("thread.active", ({ thread }) => forget(thread.id));
  bb.events.on("thread.archived", ({ thread }) => forget(thread.id));
  bb.events.on("thread.deleted", ({ thread }) => forget(thread.id));

  bb.events.on("thread.idle", async ({ thread, lastAssistantText }) => {
    forget(thread.id);
    if (thread.visibility === "hidden" || lastAssistantText === null) return;
    if (!(await settings.get()).enabled) return;
    await suggest(thread.id, thread.title ?? thread.titleFallback, lastAssistantText);
  });

  bb.rpc.register(rpcContract, {
    suggestion({ threadId }) {
      return { text: suggestions.get(threadId) ?? null };
    },
    dismiss({ threadId }) {
      forget(threadId);
      return { ok: true as const };
    },
  });

  bb.log.info("Next Prompt ready");
}
