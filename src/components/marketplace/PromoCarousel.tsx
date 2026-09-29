"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/layout/Logo";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const SLIDES = [
  {
    title: "Become a number provider",
    subtitle: "API, SIM banks, GSM gateways",
    accent: "Earn with your numbers",
    cta: { label: "Leave a request", href: "/earn-with-us" },
  },
  {
    title: "Automate your activations",
    subtitle: "A simple HTTP API for developers",
    accent: "Developer API",
    cta: { label: "Read the docs", href: "/api" },
  },
];

const INTERVAL_MS = 7000;

export function PromoCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const go = (delta: number) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[radial-gradient(120%_140%_at_85%_20%,#1f5a96_0%,#0f3b6a_45%,#081f3a_100%)] text-white shadow-card">
        {/* Decorative rings */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full border-[28px] border-accent/25" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-4 -bottom-24 size-56 rounded-full bg-accent/25 blur-2xl" />

        <div className="relative flex min-h-[230px] flex-col justify-between gap-5 p-5 sm:min-h-[260px] sm:px-14 sm:py-8">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <LogoMark className="size-8 rounded-md bg-white p-0.5" />
            {siteConfig.name}
          </div>
          {SLIDES.map((slide, i) => (
            <div
              key={slide.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              hidden={i !== index}
              className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <p className="text-[28px] leading-[1.1] font-extrabold tracking-tight sm:text-[40px]">
                  {slide.title}
                </p>
                <p className="mt-2 text-lg text-white/85 sm:text-2xl">{slide.subtitle}</p>
                <p className="mt-1 text-lg font-bold text-primary sm:text-2xl">{slide.accent}</p>
              </div>
              <ButtonLink href={slide.cta.href} size="lg" className="self-start sm:self-auto">
                {slide.cta.label} <Icon name="arrowRight" size={18} />
              </ButtonLink>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous slide"
          className="absolute top-1/2 left-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next slide"
          className="absolute top-1/2 right-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
        >
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="mt-2.5 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}`}
            aria-current={i === index}
            className={cn(
              "size-2.5 rounded-full transition-colors",
              i === index ? "bg-primary" : "bg-line-strong hover:bg-fg-subtle",
            )}
          />
        ))}
      </div>
    </section>
  );
}
