import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const CHAT_COMPLETIONS_URL =
  "https://opencode.ai/inference/go/openai/v1/chat/completions";
export const USER_AGENT = "bb-plugin-next-prompt/0.1.0";
export const DEFAULT_MODEL = "glm-5.3-flash";
const MAX_TOKENS = 600;

const authFileSchema = z.object({
  "opencode-go": z.object({ type: z.literal("api"), key: z.string().min(1) }),
});

const completionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

const errorSchema = z.object({ error: z.object({ message: z.string() }) });

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function opencodeAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  const dataHome = env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(dataHome, "opencode", "auth.json");
}

export async function readOpencodeGoKey(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const path = opencodeAuthPath(env);
  let fromFile: string | null = null;
  try {
    const parsed = authFileSchema.safeParse(
      JSON.parse(await readFile(path, "utf8")),
    );
    if (parsed.success) fromFile = parsed.data["opencode-go"].key;
  } catch {}
  const key = fromFile ?? env.OPENCODE_GO_API_KEY?.trim();
  if (!key) {
    throw new Error(
      `No OpenCode Go key: run \`opencode auth login\` and choose OpenCode Go (looked in ${path})`,
    );
  }
  return key;
}

async function upstreamMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const parsed = errorSchema.safeParse(json);
  const detail = parsed.success
    ? parsed.data.error.message
    : text.trim().slice(0, 300) || response.statusText;
  return `OpenCode Go HTTP ${response.status}: ${detail}`;
}

export interface CompleteDeps {
  fetch: typeof fetch;
  readKey: () => Promise<string>;
}

export async function complete(
  deps: CompleteDeps,
  model: string,
  messages: readonly ChatMessage[],
  signal: AbortSignal,
): Promise<string> {
  const key = await deps.readKey();
  const response = await deps.fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "user-agent": USER_AGENT,
      "x-opencode-session": randomUUID(),
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages }),
  });
  if (!response.ok) throw new Error(await upstreamMessage(response));
  const parsed = completionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("OpenCode Go returned an unexpected response shape");
  }
  return parsed.data.choices[0].message.content ?? "";
}
