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
  supportEmail: "support@example.com",
  /** Registered company details for the footer — placeholder until provided. */
  legalEntity: "Company name and registration details will appear here.",
} as const;

export type NavItem = {
  label: string;
  href: string;
};

export type NavGroup = {
  label: string;
  items: (NavItem & { description?: string })[];
};

/** Top white header bar. */
export const mainNav: (NavItem | NavGroup)[] = [
  { label: "Price", href: "/price" },
  { label: "Ready Made Accounts", href: "/accounts" },
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
  { label: "Received numbers", href: "/profile" },
  { label: "Query statistics", href: "/profile/statistics" },
  { label: "Balance history", href: "/profile/history" },
  { label: "Top up", href: "/profile/top-up" },
  { label: "Settings", href: "/profile/settings" },
];

/** Footer: primary product links (one row on desktop, like the reference). */
export const footerNav: NavItem[] = [
  { label: "Price", href: "/price" },
  // { label: "API", href: "/api" },
  // { label: "FAQ", href: "/faq" },
  // { label: "Earn with us", href: "/earn-with-us" },
  // { label: "Software", href: "/software" },
];

export const footerAccountNav: NavItem[] = [
  { label: "Log in", href: "/login" },
  { label: "Sign up", href: "/register" },
  { label: "My numbers", href: "/profile" },
  { label: "Balance history", href: "/profile/history" },
];

export const legalNav: NavItem[] = [
  { label: "Privacy & cookie policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
  { label: "Legal information", href: "/legal" },
];

export function isNavGroup(item: NavItem | NavGroup): item is NavGroup {
  return "items" in item;
}
