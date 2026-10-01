"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { completeReadyMadeOrderAction } from "@/server/actions/ready-made";

/**
 * The buyer confirms they received their Ready Made account on WhatsApp. The
 * server checks ownership and that the order is still awaiting delivery; on
 * success the page re-renders with the Completed status.
 */
export function MarkCompletedButton({ orderId, reference }: { orderId: string; reference: string }) {
  const router = useRouter();
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
        setError(r.message);
      } catch {
        setError("We couldn't reach the server. Please try again.");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="checkCircle" size={18} /> Mark as Completed
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Mark this order as completed?"
        footer={
          <>
            <Button variant="muted" onClick={() => setOpen(false)} disabled={pending}>
              Not yet
            </Button>
            <Button onClick={confirm} loading={pending} disabled={pending}>
              Yes, I received it
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[15px]">
          <p>
            Only confirm once you have received your number/account for order <span className="font-mono font-semibold">{reference}</span> on WhatsApp. This
            can&apos;t be undone.
          </p>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
