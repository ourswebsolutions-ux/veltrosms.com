import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam, UserStatusBadge } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { listUsers, type UserFilter } from "@/server/admin/users";

export const metadata: Metadata = { title: "Users" };

const SORTS = ["newest", "oldest", "name", "balance_desc", "balance_asc"] as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdminPage("/admin/users");
  const sp = await searchParams;
  const q = one(sp.q);
  const role = (["user", "admin"] as const).find((r) => r === one(sp.role));
  const status = (["active", "suspended", "deleted"] as const).find((s) => s === one(sp.status));
  const sort: UserFilter["sort"] = SORTS.find((s) => s === one(sp.sort)) ?? "newest";
  const data = await listUsers({ q, role, status, sort, page: pageParam(sp.page) });

  return (
    <Card>
      <PageHeader title="Users" description={`${data.total.toLocaleString("en-US")} matching accounts`} />
      {one(sp.deleted) && <Alert tone="success" className="mb-3">The account was deleted.</Alert>}
      <AdminFilters
        action="/admin/users"
        active={Boolean(q || role || status || sort !== "newest")}
        fields={[
          { kind: "search", name: "q", placeholder: "Name, email or user ID", value: q },
          {
            kind: "select",
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "", label: "Active & suspended" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "deleted", label: "Deleted" },
            ],
          },
          { kind: "select", name: "role", label: "Role", value: role, options: [{ value: "", label: "Any role" }, { value: "user", label: "User" }, { value: "admin", label: "Admin" }] },
          {
            kind: "select",
            name: "sort",
            label: "Sort",
            value: sort,
            options: [
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "name", label: "Name A–Z" },
              { value: "balance_desc", label: "Highest balance" },
              { value: "balance_asc", label: "Lowest balance" },
            ],
          },
        ]}
      />
      <AdminTable
        rows={data.items}
        rowKey={(u) => u.id}
        empty={<EmptyState compact icon="search" title="No users match" />}
        columns={[
          {
            header: "User",
            cell: (u) => (
              <Link href={`/admin/users/${u.id}`} className="block min-w-0 hover:text-primary">
                <span className="block truncate font-medium">
                  {u.name}
                  {u.role === "admin" && (
                    <Badge tone="warning" className="ms-1.5">
                      Admin
                    </Badge>
                  )}
                </span>
                <span className="block truncate text-xs text-fg-muted">{u.email}</span>
              </Link>
            ),
          },
          { header: "Status", cell: (u) => <UserStatusBadge status={u.status} /> },
          { header: "Balance", className: "text-end tabular-nums", cell: (u) => formatPrice(u.balance, u.currency) },
          { header: "Spent", className: "text-end tabular-nums", cell: (u) => formatPrice(u.spent, u.currency) },
          { header: "Orders", className: "text-end tabular-nums", cell: (u) => u.orders.toLocaleString("en-US") },
          { header: "Last login", className: "whitespace-nowrap text-fg-muted", cell: (u) => (u.lastLoginAt ? formatShortDateTime(u.lastLoginAt) : "—") },
          { header: "Joined", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (u) => formatShortDateTime(u.createdAt) },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/users", sp)} />
    </Card>
  );
}
