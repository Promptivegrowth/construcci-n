import type { Metadata, Viewport } from "next";
import { Lexend, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Preloader } from "@/components/layout/preloader";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Grupo Cruz · Control presupuestal", template: "%s · Grupo Cruz" },
  description: "Control presupuestal, gastos y almacén por obra del holding Grupo Cruz.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Grupo Cruz", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#062A4D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${jakarta.variable} ${lexend.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <Preloader />
        {children}
        <Toaster position="top-right" richColors closeButton
          toastOptions={{ classNames: { toast: "!rounded-2xl !border-line !shadow-pop !font-sans", title: "!font-semibold" } }} />
      </body>
    </html>
  );
}
