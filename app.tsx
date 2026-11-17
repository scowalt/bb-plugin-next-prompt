import { useCallback, useEffect, useState } from "react";
import {
  definePluginApp,
  useComposer,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./contract.ts";
import "./app.css";

function useSuggestion(threadId: string | null) {
  const rpc = useRpc<typeof rpcContract>();
  const [text, setText] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (threadId === null) return;
    rpc.call("suggestion", { threadId }).then(
      (result) => setText(result.text),
      () => setText(null),
    );
  }, [rpc, threadId]);

  useEffect(() => {
    setText(null);
    refetch();
  }, [refetch]);

  useRealtime("suggestion-changed", (payload) => {
    const changed =
      typeof payload === "object" && payload !== null && "threadId" in payload
        ? payload.threadId
        : null;
    if (changed === threadId) refetch();
  });

  const dismiss = useCallback(() => {
    setText(null);
    if (threadId !== null) void rpc.call("dismiss", { threadId });
  }, [rpc, threadId]);

  return { text, dismiss };
}

function NextPromptBanner() {
  const composer = useComposer();
  const threadId =
    composer.scope.kind === "thread" ? composer.scope.threadId : null;
  const { text, dismiss } = useSuggestion(threadId);

  useEffect(() => composer.onSubmitted(dismiss), [composer, dismiss]);

  if (text === null || !composer.isEmpty) return null;

  return (
    <div className="next-prompt-banner">
      <button
        className="next-prompt-text"
        onClick={() => {
          composer.insert(text, { at: "end" });
          composer.focus();
          dismiss();
        }}
        title="Put this in the composer"
        type="button"
      >
        {text}
      </button>
      <button
        aria-label="Dismiss suggestion"
        className="next-prompt-dismiss"
        onClick={dismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

export default definePluginApp((app) => {
  app.composer.customize({
    id: "next-prompt",
    scopes: ["thread"],
    banners: [{ id: "suggestion", chrome: "bare", component: NextPromptBanner }],
  });
});
