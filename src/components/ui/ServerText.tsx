"use client";

import { useT } from "@/i18n/client";

/** Shows an English message produced by the server in the visitor's language. */
export function ServerText({ text }: { text: string }) {
  return <>{useT().server(text)}</>;
}
