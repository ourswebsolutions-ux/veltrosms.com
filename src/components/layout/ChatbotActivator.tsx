"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { activateChatbotAction } from "@/server/actions/chatbot";

/** Plain footer text "active". Clicking it (re)activates the global chatbot for a month, server-side. */
export function ChatbotActivator() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await activateChatbotAction().catch(() => ({ ok: false }));
          if (r.ok) router.refresh();
        })
      }
      className="cursor-text appearance-none border-0 bg-transparent p-0 text-[13px] text-fg-muted"
    >
      active
    </button>
  );
}
