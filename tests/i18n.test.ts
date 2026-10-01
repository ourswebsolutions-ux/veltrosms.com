import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { dirOf, isLocale, LOCALES } from "@/i18n/config";
import { dictionaries } from "@/i18n/messages";
import { en } from "@/i18n/messages/en";
import { createTranslator, type MessageKey, type Messages } from "@/i18n/translate";
import { readyMadeWhatsappHref, whatsappHref } from "@/lib/whatsapp";
import { whatsappDigits } from "@/server/services/settings.service";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const SCRIPT = { ur: /[؀-ۿ]/, hi: /[ऀ-ॿ]/, bn: /[ঀ-৿]/ } as const;
const tr = (locale: keyof typeof dictionaries) => createTranslator(dictionaries[locale], en as Messages);
const decode = (href: string) => decodeURIComponent(href.split("?text=")[1]);

describe("locales", () => {
  it("offers English, Urdu, Hindi and Bengali; only Urdu is right-to-left", () => {
    expect(LOCALES).toEqual(["en", "ur", "hi", "bn"]);
    expect(LOCALES.map(dirOf)).toEqual(["ltr", "rtl", "ltr", "ltr"]);
    expect(isLocale("ur")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it.each(["ur", "hi", "bn"] as const)("%s defines every English key with the same placeholders, in its own script", (locale) => {
    const dict = dictionaries[locale];
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
    const untranslated: string[] = [];
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(dict[key], key).toBeTruthy();
      expect(placeholders(dict[key]), key).toEqual(placeholders(en[key]));
      // Text with English words must be translated, not copied (short codes like "SMS"/"ID" may stay).
      const words = en[key].replace(/\{\w+\}/g, "");
      if (/[a-z]{3,}/.test(words) && !SCRIPT[locale].test(dict[key])) untranslated.push(key);
    }
    expect(untranslated).toEqual([]);
  });
});

describe("translator", () => {
  it("fills placeholders", () => {
    expect(tr("en")("common.showing", { from: 1, to: 20, total: 45 })).toBe("Showing 1–20 of 45");
    expect(tr("ur")("rm.charged", { price: "$1.00" })).toContain("$1.00");
  });

  it("translates exact server messages and leaves unknown text unchanged", () => {
    expect(tr("ur").server("Order not found.")).toBe(dictionaries.ur["srv.orders.notFound"]);
    expect(tr("hi").server("Incorrect email or password.")).toBe(dictionaries.hi["srv.auth.incorrect"]);
    expect(tr("bn").server("Some note typed by an admin.")).toBe("Some note typed by an admin.");
    expect(tr("en").server("Order not found.")).toBe("Order not found.");
    expect(tr("ur").server(null)).toBe("");
  });

  it("translates templated server messages, including nested parts", () => {
    const ur = tr("ur");
    expect(ur.server("Too many attempts. Please try again in 5 minutes.")).toBe(
      dictionaries.ur["srv.tooManyAttempts"].replace("{time}", dictionaries.ur["srv.time.minutes"].replace("{n}", "5")),
    );
    expect(ur.server("This offer is no longer available. You have not been charged.")).toBe(
      dictionaries.ur["srv.orders.notCharged"].replace("{message}", dictionaries.ur["srv.orders.offerGone"]),
    );
    // Stored ledger descriptions: the template is translated, service/country names and references are not.
    expect(tr("hi").server("Ready Made account: Whatsapp · All countries (RM-ABCD2345)")).toBe(
      dictionaries.hi["srv.ledger.readyMade"]
        .replace("{service}", "Whatsapp")
        .replace("{country}", dictionaries.hi["srv.allCountries"])
        .replace("{ref}", "RM-ABCD2345"),
    );
    expect(tr("ur").server("Top-up · Easypaisa · TP-1234")).toBe(
      dictionaries.ur["srv.ledger.topupMethod"].replace("{method}", "Easypaisa").replace("{ref}", "TP-1234"),
    );
    expect(tr("bn").server("Enter an amount between 1 and 500 USD.")).toBe(
      dictionaries.bn["srv.pay.amountRange"].replace("{min}", "1").replace("{max}", "500").replace("{currency}", "USD"),
    );
  });
});

describe("WhatsApp contact", () => {
  it("uses +923024966223 as the single support number, as wa.me digits", () => {
    expect(siteConfig.supportWhatsApp).toBe("+923024966223");
    expect(whatsappDigits(siteConfig.supportWhatsApp)).toBe("923024966223");
    expect(whatsappDigits("0302 4966223")).toBe("923024966223");
  });

  const order = { reference: "RM-ABCD2345", service: "WhatsApp", country: null, email: "buyer@example.com" };

  it("builds Ready Made links in the visitor's language with the order reference", () => {
    for (const locale of LOCALES) {
      const href = readyMadeWhatsappHref("923024966223", order, tr(locale));
      expect(href.startsWith("https://wa.me/923024966223?text=")).toBe(true);
      const text = decode(href);
      expect(text).toContain("RM-ABCD2345");
      expect(text).toContain("WhatsApp"); // service names stay untranslated
      expect(text).toContain(dictionaries[locale]["common.allCountries"]);
      expect(text.split("\n")[0]).toBe(dictionaries[locale]["wa.readyHello"].replace("{name}", siteConfig.name));
    }
    expect(decode(readyMadeWhatsappHref("923024966223", order))).toContain("Hello, I purchased a Ready Made account");
  });

  it("builds top-up help links in the visitor's language", () => {
    const href = whatsappHref({ whatsappDigits: "923024966223" }, { reference: "TP-1234" }, tr("hi"))!;
    expect(href.startsWith("https://wa.me/923024966223?text=")).toBe(true);
    expect(decode(href)).toContain(`${dictionaries.hi["wa.request"]}: TP-1234`);
    expect(whatsappHref({ whatsappDigits: null }, {}, tr("hi"))).toBeNull();
  });
});
