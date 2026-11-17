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
  const [options, setOptions] = useState<readonly string[]>([]);

  const refetch = useCallback(() => {
    if (threadId === null) return;
    rpc.call("suggestion", { threadId }).then(
      (result) => setOptions(result.options),
      () => setOptions([]),
    );
  }, [rpc, threadId]);

  useEffect(() => {
    setOptions([]);
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
    setOptions([]);
    if (threadId !== null) void rpc.call("dismiss", { threadId });
  }, [rpc, threadId]);

  return { options, dismiss };
}

function NextPromptBanner() {
  const composer = useComposer();
  const threadId =
    composer.scope.kind === "thread" ? composer.scope.threadId : null;
  const { options, dismiss } = useSuggestion(threadId);

  useEffect(() => composer.onSubmitted(dismiss), [composer, dismiss]);

  if (options.length === 0 || !composer.isEmpty) return null;

  return (
    <div className="next-prompt-banner">
      {options.map((text) => (
        <button
          className="next-prompt-text"
          key={text}
          onClick={() => {
            composer.insert(text, { at: "end" });
            composer.focus();
            dismiss();
          }}
          title={text}
          type="button"
        >
          {text}
        </button>
      ))}
      <button
        aria-label="Dismiss suggestions"
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
