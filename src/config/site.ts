import type { MessageKey } from "@/i18n/translate";

/**
 * Brand identity and navigation. Everything user-facing about the brand lives
 * here so a rename touches one file.
 */
export const siteConfig = {
  name: "VirtuMSG",
  /** Public origin, used for shareable links. Placeholder until the domain is set. */
  url: "https://example.com",
  /** The logo's two-colour wordmark: "Virtu" (navy) + "MSG" (gold). */
  shortName: "Virtu",
  wordmarkAccent: "MSG",
  description:
    "Virtual phone numbers for receiving SMS verification codes from popular services worldwide.",
  tagline: "Receive SMS verification codes online",
  supportEmail: "Support@virtumsg.com",
  /**
   * Customer-support WhatsApp (international format). The single default for
   * every WhatsApp contact on the site — top-up help and Ready Made delivery.
   * Admins can override it in Admin → Settings.
   */
  supportWhatsApp: "+923024966223",
  /** Registered company details for the footer — placeholder until provided. */
  legalEntity: "Company name and registration details will appear here.",
} as const;

export type NavItem = {
  /** Dictionary key of the label (src/i18n/messages). */
  label: MessageKey;
  href: string;
};

export type NavGroup = {
  label: MessageKey;
  items: (NavItem & { description?: string })[];
};

/** Top white header bar. */
export const mainNav: (NavItem | NavGroup)[] = [
  { label: "nav.price", href: "/price" },
  { label: "nav.readyMade", href: "/accounts" },
  { label: "nav.blog", href: "/blog" },
  { label: "nav.about", href: "/about" },
  // { label: "API", href: "/api" },
  // { label: "FAQ", href: "/faq" },
  // { label: "Earn with us", href: "/earn-with-us" },
  // {
  //   label: "Software",
  //   items: [
  //     {
  //       label: "Software catalog",
  //       href: "/software",
  //       description: "Partner tools that work with our numbers",
  //     },
  //     {
  //       label: "List your software",
  //       href: "/software#developers",
  //       description: "Join the developer partner program",
  //     },
  //   ],
  // },
];

/** Orange account bar (desktop) / profile drop-down (mobile). */
export const accountNav: NavItem[] = [
  { label: "nav.receivedNumbers", href: "/profile" },
  { label: "nav.statistics", href: "/profile/statistics" },
  { label: "nav.balanceHistory", href: "/profile/history" },
  { label: "nav.topUp", href: "/profile/top-up" },
  { label: "nav.settings", href: "/profile/settings" },
];

/** Footer: primary product links (one row on desktop, like the reference). */
export const footerNav: NavItem[] = [
  { label: "nav.price", href: "/price" },
  { label: "nav.readyMade", href: "/accounts" },
  { label: "nav.blog", href: "/blog" },
  { label: "nav.about", href: "/about" },
  // { label: "API", href: "/api" },
  // { label: "FAQ", href: "/faq" },
  // { label: "Earn with us", href: "/earn-with-us" },
  // { label: "Software", href: "/software" },
];

export const footerAccountNav: NavItem[] = [
  { label: "nav.login", href: "/login" },
  { label: "nav.signup", href: "/register" },
  { label: "nav.myNumbers", href: "/profile" },
  { label: "nav.balanceHistory", href: "/profile/history" },
];

export const legalNav: NavItem[] = [
  { label: "nav.privacy", href: "/privacy" },
  { label: "nav.terms", href: "/terms" },
  { label: "nav.legal", href: "/legal" },
];

export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return "items" in item;
}
