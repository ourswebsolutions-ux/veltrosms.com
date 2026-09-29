"use client";

import { useState } from "react";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function SoftwareApply() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        Submit application
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="List your software" className="max-w-2xl">
        <PartnerForm kind="software" />
      </Modal>
    </>
  );
}
