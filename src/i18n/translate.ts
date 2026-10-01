import type { en } from "./messages/en";

/**
 * Flat, typed dictionaries: every language must define every key of the
 * English source (`satisfies Messages`), so a missing translation is a type
 * error. Values may contain {placeholders}.
 *
 * "srv.*" keys hold the English messages the SERVER produces (validation
 * errors, purchase outcomes…). The server keeps speaking English (API, logs,
 * tests); `t.server(text)` shows such a message in the visitor's language by
 * matching it against these templates.
 */
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Vars = Record<string, string | number>;

const fill = (template: string, vars?: Vars) =>
  vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template;

type Matcher = { key: MessageKey; re: RegExp; names: string[] };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildMatchers(source: Messages) {
  const exact = new Map<string, MessageKey>();
  const patterns: Matcher[] = [];
  for (const [key, text] of Object.entries(source) as [MessageKey, string][]) {
    if (!key.startsWith("srv.")) continue;
    if (!text.includes("{")) {
      exact.set(text, key);
      continue;
    }
    const names: string[] = [];
    const body = text
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escape(part);
        names.push(m[1]);
        return "(.+?)";
      })
      .join("");
    patterns.push({ key, re: new RegExp(`^${body}$`, "s"), names });
  }
  // The most specific (longest) template wins.
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, patterns };
}

let matchers: ReturnType<typeof buildMatchers> | undefined;

export type Translator = {
  (key: MessageKey, vars?: Vars): string;
  /** A server message in the visitor's language; unknown text (e.g. an admin's custom note) is returned unchanged. */
  server: (text: string | null | undefined) => string;
};

export function createTranslator(messages: Messages, source: Messages): Translator {
  const t = ((key: MessageKey, vars?: Vars) => fill(messages[key] ?? source[key] ?? key, vars)) as Translator;
  t.server = (text) => {
    if (!text) return "";
    matchers ??= buildMatchers(source);
    const hit = matchers.exact.get(text);
    if (hit) return messages[hit];
    for (const m of matchers.patterns) {
      const found = m.re.exec(text);
      if (!found) continue;
      const vars: Vars = {};
      m.names.forEach((n, i) => (vars[n] = t.server(found[i + 1])));
      return fill(messages[m.key], vars);
    }
    return text;
  };
  return t;
}
