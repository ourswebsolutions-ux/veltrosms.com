import type { ReactNode } from "react";

/**
 * Renders a blog article written in a small Markdown subset — no raw HTML is
 * ever passed through, so admin content can't inject markup or scripts.
 *   ## Heading / ### Subheading, paragraphs (blank line between),
 *   - bullet / 1. numbered lists, > quote,
 *   **bold**, *italic*, `code`, [link text](https://… or /path)
 */
export function ArticleContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = heading[1].length === 2 ? "h2" : "h3";
      blocks.push(
        <Tag key={key++} className={Tag === "h2" ? "mt-8 text-xl font-semibold text-fg sm:text-2xl" : "mt-6 text-lg font-semibold text-fg"}>
          {inline(heading[2])}
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={`mt-4 space-y-1.5 ps-6 ${ordered ? "list-decimal" : "list-disc"} marker:text-primary`}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key++} className="mt-4 border-s-4 border-primary bg-primary-tint/40 px-4 py-3 text-fg">
          {inline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>\s?|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push(
      <p key={key++} className="mt-4">
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <div className="text-[16px] leading-relaxed text-fg-muted wrap-anywhere [&>:first-child]:mt-0">{blocks}</div>;
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, n) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={n} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={n} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.9em] text-fg">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      // Only web links and site paths; anything else (javascript:, data:…) stays plain text.
      if (/^https?:\/\//i.test(href)) return <a key={n} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">{link[1]}</a>;
      if (/^\/(?!\/)/.test(href)) return <a key={n} href={href} className="text-primary underline underline-offset-2">{link[1]}</a>;
      return link[1];
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={n}>{part.slice(1, -1)}</em>;
    return part;
  });
}
