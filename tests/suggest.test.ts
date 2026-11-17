import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMessages, entryText, parseSuggestion } from "../suggest.ts";

test("parseSuggestion strips quotes and rejects NONE", () => {
  assert.equal(parseSuggestion('  "Run the tests."  '), "Run the tests.");
  assert.equal(parseSuggestion("NONE"), null);
  assert.equal(parseSuggestion("none."), null);
  assert.equal(parseSuggestion("   "), null);
});

test("parseSuggestion rejects rambling output", () => {
  assert.equal(parseSuggestion("x".repeat(401)), null);
});

test("buildMessages keeps the tail of a long agent reply", () => {
  const messages = buildMessages({
    title: "Fix login",
    userMessages: ["fix the login bug"],
    assistantText: `${"a".repeat(7000)}THE END`,
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[1].content, /Thread title: Fix login/);
  assert.match(messages[1].content, /1\. fix the login bug/);
  assert.match(messages[1].content, /THE END/);
  assert.ok(messages[1].content.length < 7000);
});

test("entryText joins only text blocks", () => {
  assert.equal(
    entryText([
      { type: "text", text: "hello" },
      { type: "image", url: "x" },
      { type: "text", text: "world" },
    ]),
    "hello\nworld",
  );
});
