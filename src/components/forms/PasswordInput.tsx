"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/icons";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/validation/auth";
import { useT } from "@/i18n/client";

const STRENGTH = ["forms.strengthWeak", "forms.strengthFair", "forms.strengthGood", "forms.strengthStrong"] as const;

/** Password field with a show/hide toggle; optional strength meter. */
export function PasswordInput({
  showStrength,
  className,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const strength = passwordStrength(value);
  const ref = useRef<HTMLInputElement>(null);
  const t = useT();

  // React resets forms after a submission; keep the meter in sync.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setValue("");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pe-12", className)}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e);
          }}
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("forms.hidePassword") : t("forms.showPassword")}
          aria-pressed={visible}
          className="absolute top-1/2 end-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunken hover:text-fg"
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={18} />
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= strength
                    ? strength <= 1
                      ? "bg-danger"
                      : strength === 2
                        ? "bg-warning"
                        : "bg-success"
                    : "bg-surface-sunken",
                )}
              />
            ))}
          </div>
          <span className="w-16 text-end text-xs text-fg-muted">
            {strength > 0 && t(STRENGTH[strength - 1])}
          </span>
        </div>
      )}
    </div>
  );
}
