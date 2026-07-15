import AppSidebar from "@/components/layout/AppSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import TopBar from "@/components/layout/TopBar";
import FloatingActionButton from "@/components/layout/FloatingActionButton";
import DevLoginWrapper from "@/components/shared/DevLoginWrapper";
import SubscriptionGate from "@/components/shared/SubscriptionGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DevLoginWrapper>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F9FAFB] font-sans antialiased">
        <SubscriptionGate>
          <div className="flex flex-1 min-h-0 flex-col w-full overflow-hidden">
            {/* Mobile Top Header (hidden on desktop) */}
            <MobileHeader />

            <div className="flex flex-1 h-full w-full overflow-hidden">
              {/* Desktop Sidebar (hidden on mobile) */}
              <AppSidebar className="hidden lg:flex" />

              {/* Main Content Area */}
              <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
                {/* Desktop Top Header (hidden on mobile) */}
                <TopBar />

                {/* Page Scroll Body */}
                <main className="flex-1 overflow-y-auto relative p-4 md:p-6 lg:p-8 pb-24 lg:pb-32">
                  {children}
                </main>
              </div>
            </div>

            {/* Global Floating Action Button */}
            <FloatingActionButton />
          </div>
        </SubscriptionGate>
      </div>
    </DevLoginWrapper>
  );
}
