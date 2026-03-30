import type { Metadata } from "next";
import { Cinzel, Playfair_Display, Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import "@/styles/Battlemap.css";
import "@/styles/BattlemapToolbar.css";
import { HeaderWrapper } from "@/components/HeaderWrapper";
import { FloatingNotes } from "@/components/FloatingNotes";
import { Suspense } from "react";


const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-header",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-narrative",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-victorian",
});

export const metadata: Metadata = {
  title: "Fate Companion | Project GM",
  description: "Plataforma avançada para narração e automação de mesas de RPG (Fate Core)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${playfair.variable} ${inter.variable} ${cormorant.variable}`}>
      <body>
        <div className="main-layout">
          <Suspense fallback={null}>
            <HeaderWrapper />
          </Suspense>
          <main className="container">{children}</main>
          <Suspense fallback={null}>
            <FloatingNotes />
          </Suspense>
        </div>

      </body>
    </html>
  );
}
