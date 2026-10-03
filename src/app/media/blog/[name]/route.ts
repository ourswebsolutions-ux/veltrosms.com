import { readBlogImage } from "@/server/blog/images";

/** Serves an uploaded blog image. Names are random and immutable, so it can be cached for long. */
export async function GET(_req: Request, ctx: RouteContext<"/media/blog/[name]">) {
  const { name } = await ctx.params;
  const image = await readBlogImage(name);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
