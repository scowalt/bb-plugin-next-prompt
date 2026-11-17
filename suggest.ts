import type { ChatMessage } from "./opencode-go.ts";

const MAX_ASSISTANT_CHARS = 6000;
const MAX_USER_CHARS = 800;
const MAX_SUGGESTION_CHARS = 400;

export const SYSTEM_PROMPT = `You predict the next message a developer will send to their AI coding agent.
Write exactly what the developer would type: first person, imperative, one or two short sentences, matching the tone and brevity of their earlier messages.
Choose the single most likely next step, for example answering a question the agent asked, picking an option the agent offered, fixing a problem the agent reported, running the tests, or committing.
If the agent's work looks finished and no next step is obvious, reply with exactly NONE.
Output only the message: no quotes, no preface, no explanation.`;

export interface SuggestionContext {
  title: string | null;
  userMessages: readonly string[];
  assistantText: string;
}

function tail(text: string, max: number): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`;
}

export function buildMessages(context: SuggestionContext): ChatMessage[] {
  const user = context.userMessages
    .map((text, index) => `${index + 1}. ${tail(text.trim(), MAX_USER_CHARS)}`)
    .join("\n");
  const sections = [
    context.title ? `Thread title: ${context.title}` : null,
    user ? `The developer's recent messages, oldest first:\n${user}` : null,
    `The agent's latest reply:\n${tail(context.assistantText.trim(), MAX_ASSISTANT_CHARS)}`,
    "Write the developer's next message.",
  ].filter((section): section is string => section !== null);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: sections.join("\n\n") },
  ];
}

export function parseSuggestion(raw: string): string | null {
  let text = raw.trim();
  const quoted = /^(["'“‘`])([\s\S]*)(["'”’`])$/u.exec(text);
  if (quoted) text = quoted[2].trim();
  if (text.length === 0 || /^none\.?$/iu.test(text)) return null;
  if (text.length > MAX_SUGGESTION_CHARS) return null;
  return text;
}

interface TextBlock {
  type: "text";
  text: string;
}

function isTextBlock(block: unknown): block is TextBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "text" &&
    "text" in block &&
    typeof block.text === "string"
  );
}

export function entryText(input: readonly unknown[]): string {
  return input
    .filter(isTextBlock)
    .map((block) => block.text)
    .join("\n")
    .trim();
}
