"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { OrderListItem } from "@/types/account";
import { NumberCard } from "./NumberCard";

/**
 * The viewer's live numbers. Server renders refresh the list after every
 * money-changing action; numbers that closed while shown here (finished,
 * cancelled, expired) stay visible with their final status until the page is
 * left, so the customer sees the outcome instead of the card vanishing.
 */
export function ActiveOrdersList({
  orders,
  empty,
  className,
}: {
  orders: OrderListItem[];
  empty?: ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState(orders);
  const [prev, setPrev] = useState(orders);
  if (orders !== prev) {
    // New numbers first; keep the ones that closed meanwhile.
    const incoming = new Set(orders.map((o) => o.id));
    setShown([...orders, ...shown.filter((o) => !incoming.has(o.id))]);
    setPrev(orders);
  }

  if (shown.length === 0) return <>{empty}</>;
  return (
    <div className={cn("grid grid-cols-1 gap-3", className)}>
      {shown.map((o) => (
        <NumberCard key={o.id} order={o} />
      ))}
    </div>
  );
}
