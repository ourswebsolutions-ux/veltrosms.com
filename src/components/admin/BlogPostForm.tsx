"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/forms/FormParts";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Input";
import { useResultToast } from "@/components/ui/Toast";
import type { FormState } from "@/types/forms";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

export type BlogFormInitial = {
  id?: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  featuredImage: string;
  /** ISO date-time or "". */
  publishedAt: string;
  published: boolean;
};

/** Same rule as the server's slugify (the server re-checks everything). */
const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

/** ISO → value for <input type="datetime-local"> in the admin's own time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Create / edit a blog post. "Save draft" keeps it private; "Publish" makes it
 * public from the publication date (now when empty). The featured image is an
 * uploaded file (PNG/JPEG/WebP/GIF, max 3 MB) or an image URL.
 */
export function BlogPostForm({ action, initial, categories }: { action: Action; initial: BlogFormInitial; categories: string[] }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [when, setWhen] = useState(toLocalInput(initial.publishedAt));
  const [preview, setPreview] = useState(initial.featuredImage);

  return (
    <form action={run} className="space-y-4">
      {initial.id !== undefined && <input type="hidden" name="id" value={initial.id} />}
      {/* The server receives an absolute time, not the browser-local value. */}
      <input type="hidden" name="publishedAt" value={when ? new Date(when).toISOString() : ""} />
      <Field label="Title" required>
        {(p) => (
          <Input
            {...p}
            name="title"
            value={title}
            maxLength={200}
            required
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Slug" required hint={`Address: /blog/${slug || "…"}`}>
          {(p) => (
            <Input
              {...p}
              name="slug"
              value={slug}
              maxLength={160}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          )}
        </Field>
        <Field label="Category" hint="Optional, e.g. Guides or News.">
          {(p) => <Input {...p} name="category" defaultValue={initial.category} maxLength={60} list="blog-categories" />}
        </Field>
        <datalist id="blog-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <Field label="Excerpt" required hint="One or two sentences shown on the blog list (10–500 characters).">
        {(p) => <Textarea {...p} name="excerpt" defaultValue={initial.excerpt} rows={2} maxLength={500} required />}
      </Field>
      <Field
        label="Content"
        required
        hint="Blank line between paragraphs. ## Heading, ### Subheading, - bullet, 1. numbered, > quote, **bold**, *italic*, [link](https://…)."
      >
        {(p) => <Textarea {...p} name="content" defaultValue={initial.content} rows={16} className="font-mono text-sm leading-relaxed" required />}
      </Field>

      <fieldset className="space-y-3 rounded-xl border border-line p-4">
        <legend className="px-1 text-sm text-fg">Featured image</legend>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded files and admin-given URLs, shown as-is
          <img src={preview} alt="" className="aspect-[16/9] w-full max-w-sm rounded-lg border border-line object-cover" />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Upload an image" hint="PNG, JPEG, WebP or GIF, max 3 MB. Replaces the current image.">
            {(p) => (
              <input
                {...p}
                type="file"
                name="imageFile"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="block w-full min-w-0 text-sm text-fg-muted file:me-3 file:rounded-md file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:font-semibold file:text-primary"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPreview(URL.createObjectURL(f));
                }}
              />
            )}
          </Field>
          <Field label="…or image URL" hint="https://… (used when no file is uploaded).">
            {(p) => <Input {...p} name="featuredImage" defaultValue={initial.featuredImage} maxLength={500} inputMode="url" onBlur={(e) => e.target.value && setPreview(e.target.value)} />}
          </Field>
        </div>
        {initial.featuredImage && <Checkbox name="removeImage" label="Remove the featured image" />}
      </fieldset>

      <Field label="Publication date" hint="Empty = when you press Publish. A future date schedules the post.">
        {(p) => <Input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="max-w-xs" />}
      </Field>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <IntentButton intent="publish" label={initial.published ? "Save & keep published" : "Publish"} />
        <IntentButton intent="draft" label={initial.published ? "Unpublish & save as draft" : "Save draft"} outline />
      </div>
    </form>
  );
}

function IntentButton({ intent, label, outline }: { intent: "draft" | "publish"; label: string; outline?: boolean }) {
  const { pending, data } = useFormStatus();
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      loading={pending && data?.get("intent") === intent}
      disabled={pending}
      variant={outline ? "outline" : "primary"}
      className={outline ? "!bg-surface !text-primary ring-1 ring-primary hover:!bg-primary-tint" : undefined}
    >
      {label}
    </Button>
  );
}
