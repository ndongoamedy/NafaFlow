import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "NafaFlow - Invoicing & Treasury",
  description: "La plateforme de facturation et de trésorerie moderne pour les PME",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">
        {children}
        {/* Toast provider wrapper */}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
