import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMessages, entryText, parseSuggestions } from "../suggest.ts";

test("parseSuggestions splits lines and strips quotes and list markers", () => {
  assert.deepEqual(
    parseSuggestions('"Run the tests."\n2. Commit it\n- `Open a PR`\n\n', 3),
    ["Run the tests.", "Commit it", "Open a PR"],
  );
});

test("parseSuggestions rejects NONE and empty output", () => {
  assert.deepEqual(parseSuggestions("NONE", 3), []);
  assert.deepEqual(parseSuggestions("none.", 3), []);
  assert.deepEqual(parseSuggestions("   ", 3), []);
});

test("parseSuggestions drops rambling lines and duplicates, and caps the count", () => {
  assert.deepEqual(
    parseSuggestions(`${"x".repeat(401)}\nRun tests\nrun tests\nCommit\nPush\nShip`, 2),
    ["Run tests", "Commit"],
  );
});

test("buildMessages keeps the tail of a long agent reply", () => {
  const messages = buildMessages({
    title: "Fix login",
    userMessages: ["fix the login bug"],
    assistantText: `${"a".repeat(7000)}THE END`,
    count: 3,
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /up to 3 different/);
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
