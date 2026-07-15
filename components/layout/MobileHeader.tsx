"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import AppSidebar from "./AppSidebar";

export default function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#0F3E2B] text-white lg:hidden border-b border-[#15803D]/30 sticky top-0 z-40 shadow-md">
      {/* Mobile Drawer Trigger using shadcn/ui Sheet */}
      <div className="flex items-center gap-3">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-green-100 hover:text-white hover:bg-emerald-900/40 h-10 w-10 shrink-0"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 bg-[#0F3E2B] border-r border-[#15803D]/30 w-64">
            <AppSidebar onItemClick={() => setIsOpen(false)} className="border-r-0" />
          </SheetContent>
        </Sheet>
        
        {/* NafaFlow Logo */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm shadow-black/30 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Logo NafaFlow" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-bold text-base tracking-tight">NafaFlow</span>
        </div>
      </div>
    </header>
  );
}
