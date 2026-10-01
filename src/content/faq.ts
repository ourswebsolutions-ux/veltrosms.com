import type { MessageKey } from "@/i18n/translate";

/** FAQ content as dictionary keys (text lives in src/i18n/messages). */
export type FaqEntry = { question: MessageKey; answer: MessageKey[] };

/** Resolved text for rendering and searching. */
export type FaqText = { question: string; answer: string[] };

export const FAQ: FaqEntry[] = [
  { question: "faq.q1", answer: ["faq.a1_1"] },
  { question: "faq.q2", answer: ["faq.a2_1", "faq.a2_2"] },
  { question: "faq.q3", answer: ["faq.a3_1"] },
  { question: "faq.q4", answer: ["faq.a4_1", "faq.a4_2"] },
  { question: "faq.q5", answer: ["faq.a5_1"] },
  { question: "faq.q6", answer: ["faq.a6_1"] },
  { question: "faq.q7", answer: ["faq.a7_1"] },
  { question: "faq.q8", answer: ["faq.a8_1"] },
  { question: "faq.q9", answer: ["faq.a9_1"] },
];
