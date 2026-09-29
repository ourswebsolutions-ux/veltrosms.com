"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import type { ApiMethod, ApiSection } from "@/content/api-docs";

export function ApiReference({ sections }: { sections: ApiSection[] }) {
  const [sectionId, setSectionId] = useState(sections[0].id);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const [methodId, setMethodId] = useState(section.methods[0].id);
  const method = section.methods.find((m) => m.id === methodId) ?? section.methods[0];

  return (
    <>
      <div className="flex justify-center">
        <SegmentedTabs
          label="API section"
          value={sectionId}
          onChange={(id) => {
            setSectionId(id);
            setMethodId(sections.find((s) => s.id === id)!.methods[0].id);
          }}
          items={sections.map((s) => ({ value: s.id, label: s.label }))}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <ul className="space-y-2.5">
          {section.methods.map((m) => {
            const active = m.id === method.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  aria-current={active}
                  className={cn(
                    "flex min-h-13 w-full items-center gap-3 rounded-lg border px-5 py-3 text-left text-[17px] transition-colors",
                    active
                      ? "border-primary bg-primary-tint text-primary"
                      : "border-transparent bg-surface-muted text-fg-muted hover:text-fg",
                  )}
                >
                  <span className="flex-1">{m.title}</span>
                  {!m.auth && <Badge tone="neutral">Public</Badge>}
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
        <MethodDetail method={method} />
      </div>
    </>
  );
}

function MethodDetail({ method }: { method: ApiMethod }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(method.path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <article className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-2xl font-medium">{method.title}</h3>
        <Badge tone={method.auth ? "soft" : "neutral"}>{method.auth ? "API key" : "Public"}</Badge>
      </div>

      <div className="mt-4 flex items-stretch gap-2 rounded-lg bg-primary-tint p-3 pl-4">
        <code className="flex-1 self-center font-mono text-[15px] break-all text-primary">
          <span className="font-bold">{method.method}</span> {method.path}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy endpoint"
          className="flex w-10 shrink-0 items-center justify-center rounded-md border border-primary text-primary hover:bg-primary hover:text-white"
        >
          <Icon name={copied ? "check" : "copy"} size={18} />
        </button>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed">{method.description}</p>
      <p className="mt-2 text-[15px] text-fg-muted">
        {method.auth ? (
          <>
            Requires your API key in the <code className="text-primary">Authorization: Bearer</code> header
            (generate it in <span className="text-primary">Settings</span>).
          </>
        ) : (
          "No authentication required."
        )}
      </p>

      {method.params.length > 0 && (
        <>
          <h4 className="mt-5 mb-2 font-semibold">Parameters</h4>
          <ul className="space-y-1.5 text-[15px]">
            {method.params.map((p) => (
              <li key={p.name}>
                <code className="text-primary">{p.name}</code>
                {p.required && <span className="text-danger">*</span>} — {p.description}
              </li>
            ))}
          </ul>
        </>
      )}

      {method.errors && (
        <>
          <h4 className="mt-5 mb-2 font-semibold">Possible errors</h4>
          <ul className="space-y-1.5 text-[15px]">
            {method.errors.map((e) => (
              <li key={e.code}>
                <code className="text-primary">{e.code}</code> — {e.description}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="mt-5 mb-2 font-semibold">Example response</h4>
      <pre className="overflow-x-auto rounded-lg bg-surface-muted p-4 font-mono text-[13px] leading-relaxed">
        {method.example}
      </pre>
    </article>
  );
}
