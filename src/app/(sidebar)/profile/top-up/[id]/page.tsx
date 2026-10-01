import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaymentStatusView } from "@/components/payments/PaymentStatusView";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile } from "@/server/services/account.service";
import { getTopUp, getTopUpOptions } from "@/server/services/payment.service";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("pay.payment") };
}

/**
 * Where the payment provider sends the customer back. Arriving here proves
 * nothing: the payment is looked up by id for the signed-in owner only, and
 * its status is re-checked with the provider before anything is shown.
 */
export default async function PaymentPage({ params }: PageProps<"/profile/top-up/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/profile/top-up/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const payment = await getTopUp(user.id, id);
  if (!payment) notFound();
  const [profile, options] = await Promise.all([getAccountProfile(user), getTopUpOptions()]);

  return (
    <Card className="sm:!p-8">
      <PaymentStatusView payment={payment} balance={profile.balance} help={options.manual} email={profile.email} />
    </Card>
  );
}
