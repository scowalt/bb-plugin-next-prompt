import type { ChatMessage } from "./opencode-go.ts";

const MAX_ASSISTANT_CHARS = 6000;
const MAX_USER_CHARS = 800;
const MAX_SUGGESTION_CHARS = 400;

export const DEFAULT_SUGGESTION_COUNT = 3;
export const MAX_SUGGESTION_COUNT = 5;

export function systemPrompt(count: number): string {
  return `You predict the next message a developer will send to their AI coding agent.
Write up to ${count} different candidate messages, each exactly what the developer would type: first person, imperative, one or two short sentences, matching the tone and brevity of their earlier messages.
Put the most likely message first. Make each candidate a genuinely different next step, for example answering a question the agent asked, picking each option the agent offered, fixing a problem the agent reported, running the tests, or committing. Write fewer candidates rather than padding with weak ones.
If the agent's work looks finished and no next step is obvious, reply with exactly NONE.
Output one message per line and nothing else: no numbering, no bullets, no quotes, no preface, no explanation.`;
}

export interface SuggestionContext {
  title: string | null;
  userMessages: readonly string[];
  assistantText: string;
  count: number;
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
    "Write the developer's possible next messages.",
  ].filter((section): section is string => section !== null);
  return [
    { role: "system", content: systemPrompt(context.count) },
    { role: "user", content: sections.join("\n\n") },
  ];
}

function cleanLine(line: string): string {
  let text = line.trim().replace(/^(?:[-*•]|\d+[.)])\s+/u, "");
  const quoted = /^(["'“‘`])([\s\S]*)(["'”’`])$/u.exec(text);
  if (quoted) text = quoted[2].trim();
  return text;
}

export function parseSuggestions(raw: string, count: number): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const line of raw.split("\n")) {
    const text = cleanLine(line);
    if (text.length === 0 || /^none\.?$/iu.test(text)) continue;
    if (text.length > MAX_SUGGESTION_CHARS) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(text);
  }
  return options.slice(0, count);
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
