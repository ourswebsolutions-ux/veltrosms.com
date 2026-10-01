"use client";

import { useState } from "react";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/client";

export function SoftwareApply() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        {t("software.apply")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("software.listYours")} className="max-w-2xl">
        <PartnerForm kind="software" />
      </Modal>
    </>
  );
}
