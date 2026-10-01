"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { completeReadyMadeOrderAction } from "@/server/actions/ready-made";
import { useT } from "@/i18n/client";

/**
 * The buyer confirms they received their Ready Made account on WhatsApp. The
 * server checks ownership and that the order is still awaiting delivery; on
 * success the page re-renders with the Completed status.
 */
export function MarkCompletedButton({ orderId, reference }: { orderId: string; reference: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await completeReadyMadeOrderAction(orderId);
        if (r.ok || r.code === "ALREADY_COMPLETED") {
          setOpen(false);
          router.refresh();
          return;
        }
        setError(t.server(r.message));
      } catch {
        setError(t("order.unreachable"));
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="checkCircle" size={18} /> {t("rm.markCompleted")}
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t("rm.markTitle")}
        footer={
          <>
            <Button variant="muted" onClick={() => setOpen(false)} disabled={pending}>
              {t("rm.notYet")}
            </Button>
            <Button onClick={confirm} loading={pending} disabled={pending}>
              {t("rm.yesReceived")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[15px]">
          <p>
            {t("rm.markBody.before")}
            <bdi className="font-mono font-semibold">{reference}</bdi>
            {t("rm.markBody.after")}
          </p>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
