import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, DeleteUserButton, EditUserForm, SuspendUserButton, WalletAdjustForm } from "@/components/admin/AdminForms";
import { KeyValues, Stat, UserStatusBadge, YesNo } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatus";
import { TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPrice, formatShortDateTime } from "@/lib/format";
import {
  adminActivateUserAction,
  adminAdjustWalletAction,
  adminDeleteUserAction,
  adminEditUserAction,
  adminForceLogoutAction,
  adminPasswordResetAction,
  adminRevokeApiKeyAction,
  adminSuspendUserAction,
  adminUserRoleAction,
} from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { listAdminOrders, listAdminPayments, userLedger } from "@/server/admin/orders";
import { getUserDetail } from "@/server/admin/users";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const admin = await requireAdminPage(`/admin/users/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUserDetail(id);
  if (!user) notFound();
  const [orders, payments, ledger] = await Promise.all([listAdminOrders({ userId: id, pageSize: 8 }), listAdminPayments({ userId: id, pageSize: 8 }), userLedger(id, 12)]);
  const self = user.id === admin.id;
  const deleted = user.status === "deleted";
  const money = (v: number) => formatPrice(v, user.currency);

  return (
    <>
      <Card>
        <Breadcrumbs items={[{ label: "Users", href: "/admin/users" }, { label: user.email }]} className="mb-3" />
        <PageHeader
          title={user.name}
          description={user.email}
          actions={
            <span className="flex flex-wrap gap-1.5">
              <UserStatusBadge status={user.status} />
              {user.role === "admin" && <Badge tone="warning">Admin</Badge>}
              {self && <Badge tone="neutral">You</Badge>}
            </span>
          }
        />
        {user.suspension && (
          <Alert tone="error" title="Suspended" className="mb-4">
            {user.suspension.reason ?? "No reason recorded"} — {formatDateTime(user.suspension.at)}
            {user.suspension.by ? ` by ${user.suspension.by}` : ""}
          </Alert>
        )}
        {deleted && <Alert className="mb-4">This account was deleted. Its orders and ledger entries are kept for accounting.</Alert>}
        <KeyValues
          rows={[
            [
              "User ID",
              <span key="id" className="inline-flex items-center gap-1 font-mono text-xs">
                {user.id}
                <CopyButton value={user.id} label="Copy user ID" className="size-6" />
              </span>,
            ],
            ["Role", user.role === "admin" ? "Administrator" : "User"],
            ["Phone", "Not collected"],
            ["Registered", formatDateTime(user.createdAt)],
            ["Last login", user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"],
            ["Last activity", user.lastActiveAt ? formatDateTime(user.lastActiveAt) : "—"],
            ["Active sessions", String(user.activeSessions)],
            ["API key", <YesNo key="k" value={user.hasApiKey} yes="Issued" no="None" />],
          ]}
        />
      </Card>

      {!deleted && (
        <Card>
          <PageHeader as="h2" title="Account actions" description="Every action is confirmed and recorded in the audit log." />
          {self ? (
            <p className="mb-3 text-sm text-fg-muted">You can&apos;t suspend, delete or change the role of your own account.</p>
          ) : (
            <div className="mb-4 flex flex-wrap items-start gap-3">
              {user.status === "active" ? (
                <SuspendUserButton action={adminSuspendUserAction} userId={user.id} email={user.email} />
              ) : (
                <ActionButton
                  action={adminActivateUserAction}
                  fields={{ userId: user.id }}
                  label="Activate account"
                  tone="primary"
                  confirm={{ title: "Activate this account?", body: `${user.email} will be able to log in, buy numbers and use the API again.`, cta: "Activate" }}
                />
              )}
              {user.role === "admin" ? (
                <ActionButton
                  action={adminUserRoleAction}
                  fields={{ userId: user.id, role: "user" }}
                  label="Remove admin role"
                  confirm={{ title: "Remove administrator rights?", body: `${user.email} will lose access to the admin panel.`, cta: "Remove" }}
                />
              ) : (
                <ActionButton
                  action={adminUserRoleAction}
                  fields={{ userId: user.id, role: "admin" }}
                  label="Make admin"
                  confirm={{ title: "Grant administrator rights?", body: `${user.email} will get full access to the admin panel, including balances and payments.`, cta: "Make admin" }}
                />
              )}
              {user.role !== "admin" && <DeleteUserButton action={adminDeleteUserAction} userId={user.id} email={user.email} balance={money(user.balance)} />}
            </div>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton
              action={adminPasswordResetAction}
              fields={{ userId: user.id }}
              label="Send password reset"
              confirm={{ title: "Send a password-reset email?", body: `A single-use link is emailed to ${user.email}. You never see or set the password.`, cta: "Send link" }}
            />
            <ActionButton
              action={adminForceLogoutAction}
              fields={{ userId: user.id }}
              label="Log out all sessions"
              confirm={{ title: "Log out everywhere?", body: "Every session of this account ends now (your own current session is kept)." }}
            />
            {user.hasApiKey && (
              <ActionButton
                action={adminRevokeApiKeyAction}
                fields={{ userId: user.id }}
                label="Revoke API key"
                confirm={{ title: "Revoke API key?", body: "Requests using the current key will be rejected immediately." }}
              />
            )}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 font-semibold">Edit profile</h3>
            <EditUserForm action={adminEditUserAction} userId={user.id} name={user.name} email={user.email} />
          </div>
        </Card>
      )}

      <Card id="wallet">
        <PageHeader
          as="h2"
          title="Wallet"
          description="Totals from the ledger."
          actions={
            <ButtonLink href={`/admin/transactions?userId=${user.id}`} size="sm" variant="ghost">
              All transactions
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon="wallet" label="Balance" value={money(user.balance)} />
          <Stat icon="plus" label="Deposits" value={money(user.totals.deposits)} />
          <Stat icon="chart" label="Net spending" value={money(user.spent)} hint={`Purchases ${money(-user.totals.purchases)}`} />
          <Stat icon="refresh" label="Refunds" value={money(user.totals.refunds)} />
          <Stat icon="settings" label="Adjustments" value={money(user.totals.adjustments)} />
        </div>
        {!deleted && (
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="mb-3 font-semibold">Manual adjustment</h3>
            <WalletAdjustForm action={adminAdjustWalletAction} userId={user.id} currency={user.currency} balance={user.balance} email={user.email} />
          </div>
        )}
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 font-semibold">Recent ledger entries</h3>
          <AdminTable
            rows={ledger}
            rowKey={(t) => t.id}
            empty={<EmptyState compact icon="history" title="No ledger entries" />}
            columns={[
              { header: "Date", className: "whitespace-nowrap text-fg-muted", cell: (t) => formatShortDateTime(t.createdAt) },
              { header: "Type", cell: (t) => TRANSACTION_LABEL[t.type] },
              { header: "Details", desktopOnly: true, cell: (t) => <span className="text-fg-muted">{t.description ?? "—"}</span> },
              { header: "Amount", className: "text-end tabular-nums", cell: (t) => <span className={cn(t.amount >= 0 && "text-success")}>{t.amount >= 0 ? "+" : "−"}{money(Math.abs(t.amount))}</span> },
              { header: "Balance", className: "text-end tabular-nums text-fg-muted", cell: (t) => money(t.balanceAfter) },
            ]}
          />
        </div>
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Orders"
          description={`${user.orderCounts.total} total · ${user.orderCounts.completed} successful · ${user.orderCounts.failed} failed · ${user.orderCounts.active} pending · ${user.orderCounts.cancelled} cancelled/expired`}
          actions={
            <ButtonLink href={`/admin/orders?userId=${user.id}`} size="sm" variant="ghost">
              All orders
            </ButtonLink>
          }
        />
        <AdminTable
          rows={orders.items}
          rowKey={(o) => o.id}
          empty={<EmptyState compact icon="phone" title="No orders" />}
          columns={[
            { header: "Order", cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-mono text-primary hover:underline">#{o.id.slice(0, 8)}</Link> },
            { header: "Service", cell: (o) => <span className="flex items-center gap-2"><ServiceAvatar logo={o.service.logo} size={20} />{o.service.name} · {o.country.name}</span> },
            { header: "Status", cell: (o) => <OrderStatus status={o.status} /> },
            { header: "Amount", className: "text-end tabular-nums", cell: (o) => formatPrice(o.price, o.currency) },
            { header: "Date", className: "whitespace-nowrap text-fg-muted", cell: (o) => formatShortDateTime(o.createdAt) },
          ]}
        />
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Payments"
          description={`${user.paymentCounts.pending} pending · ${user.paymentCounts.approved} approved · ${user.paymentCounts.rejected} rejected · ${money(user.paymentCounts.totalPaid)} paid in total`}
          actions={
            <ButtonLink href={`/admin/topups?status=all&userId=${user.id}`} size="sm" variant="ghost">
              All top-ups
            </ButtonLink>
          }
        />
        <AdminTable
          rows={payments.items}
          rowKey={(p) => p.id}
          empty={<EmptyState compact icon="wallet" title="No payments" />}
          columns={[
            { header: "Payment", cell: (p) => <Link href={p.provider === "manual" ? `/admin/topups/${p.id}` : `/admin/payments/${p.id}`} className="font-mono text-primary hover:underline">{p.reference}</Link> },
            { header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} manual={p.provider === "manual"} /> },
            { header: "Reference", className: "font-mono text-xs", cell: (p) => p.providerPaymentId ?? "—" },
            { header: "Amount", className: "text-end tabular-nums", cell: (p) => formatPrice(p.amount, p.currency) },
            { header: "Date", className: "whitespace-nowrap text-fg-muted", cell: (p) => formatShortDateTime(p.createdAt) },
          ]}
        />
      </Card>

      <Card>
        <PageHeader as="h2" title="Security and activity" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Admin actions on this account</h3>
            {user.history.length === 0 ? (
              <EmptyState compact icon="shield" title="No admin actions" />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {user.history.map((h) => (
                  <li key={h.id} className="py-2">
                    <p className={h.success ? "font-medium" : "font-medium text-danger"}>{h.description ?? h.action}</p>
                    <p className="text-xs text-fg-subtle">
                      {h.actorEmail ?? "system"} · {formatShortDateTime(h.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Security events</h3>
            {user.security.length === 0 ? (
              <EmptyState compact icon="lock" title="No security events" />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {user.security.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={e.level === "WARN" ? "text-danger" : undefined}>{e.event.replace(/_/g, " ")}</span>
                    <span className="text-xs text-fg-subtle">{formatShortDateTime(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
