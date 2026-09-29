/** Full-width pages (price table, API docs, partner pages, auth). */
export default function FullWidthLayout({ children }: { children: React.ReactNode }) {
  return <main className="py-4 lg:py-6">{children}</main>;
}
