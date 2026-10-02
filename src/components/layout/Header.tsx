import { PageContainer } from "@/components/ui/PageContainer";
import { getCurrentUser } from "@/server/auth/session";
import { getAccountProfile } from "@/server/services/account.service";
import { AccountBar } from "./AccountBar";
import { CurrencyMenu, LanguageMenu, NotificationsMenu, SoundToggle, ThemeToggle } from "./HeaderControls";
import { Logo } from "./Logo";
import { MobileNavbar } from "./MobileNavbar";
import { Navbar } from "./Navbar";

/**
 * Sticky site header: white bar (logo, nav, controls) + brand account bar.
 * Below lg the nav collapses into MobileNavbar and the account bar into a pill.
 */
export async function Header() {
  const user = await getCurrentUser();
  const profile = user ? await getAccountProfile(user) : null;

  return (
    <header className="sticky top-0 z-40 shadow-[0_2px_8px_rgba(34,37,45,0.06)]">
      <div className="bg-surface">
        <PageContainer className="flex h-14 items-center gap-2 sm:h-16 sm:gap-3 xl:gap-6">
          <Logo />
          <Navbar />
          {/* Phones: compact currency/language triggers; notifications, theme and sound move into the menu. */}
          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <CurrencyMenu />
            <LanguageMenu />
            <ThemeToggle className="hidden lg:flex" />
            <NotificationsMenu className="hidden sm:block" />
            <SoundToggle className="hidden lg:flex" />
            <MobileNavbar />
          </div>
        </PageContainer>
      </div>
      <AccountBar
        user={
          profile
            ? { name: profile.name, email: profile.email, balance: profile.balance, currency: profile.currency, isAdmin: user?.role === "admin" }
            : null
        }
      />
    </header>
  );
}
