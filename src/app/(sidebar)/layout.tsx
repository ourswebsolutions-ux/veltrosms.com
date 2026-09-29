import { MarketplaceSidebar } from "@/components/marketplace/MarketplaceSidebar";
import { PageContainer } from "@/components/ui/PageContainer";
import { getCurrentUser } from "@/server/auth/session";
import { getViewer } from "@/server/services/account.service";
import { listActiveOrders } from "@/server/services/order.service";
import { getOffersForService, listServices } from "@/server/services/catalog.service";

/** Featured first in the sidebar (provider code for WhatsApp); falls back to the first service. */
const PREFERRED_SERVICE = "wa";

/**
 * Two-column shell: marketplace sidebar on the left, page content on the right.
 * Used by the home, FAQ and profile pages.
 */
export default async function SidebarLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [services, viewer, activeOrders] = await Promise.all([
    listServices(),
    getViewer(),
    user ? listActiveOrders(user.id) : [],
  ]);
  const initialService = services.find((s) => s.slug === PREFERRED_SERVICE)?.slug ?? services[0]?.slug ?? "";
  const initialOffers = await getOffersForService(initialService);

  return (
    <PageContainer className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 py-4 lg:grid-cols-[minmax(0,41fr)_minmax(0,59fr)] lg:py-5">
      <MarketplaceSidebar
        services={services}
        initialService={initialService}
        initialOffers={initialOffers}
        viewer={viewer}
        activeOrders={activeOrders}
      />
      <main className="min-w-0 space-y-4">{children}</main>
    </PageContainer>
  );
}
