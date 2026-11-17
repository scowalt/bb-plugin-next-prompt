import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const rpcContract = defineRpcContract({
  suggestion: {
    input: z.object({ threadId: z.string().min(1) }).strict(),
    output: z.object({ options: z.array(z.string()) }),
  },
  dismiss: {
    input: z.object({ threadId: z.string().min(1) }).strict(),
    output: z.object({ ok: z.literal(true) }),
  },
});
