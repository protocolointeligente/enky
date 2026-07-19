import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

// Brand typefaces (manual §6): Space Grotesk for headings, Inter for interface
// and body. Self-hosted by next/font — no external CDN request at runtime.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ENKY — Inteligência para cada decisão",
  description:
    "Plataforma de performance humana para treinadores: prescreva, acompanhe e decida com dados — carga, prontidão e evolução do atleta em um só lugar. Comece grátis com 1 atleta.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ENKY" },
};

export const viewport: Viewport = {
  themeColor: "#04202b",
  // Evita zoom acidental durante o treino, respeitando safe-area de aparelhos com recorte.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${spaceGrotesk.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Anti-flash: resolve o tema (system|light|dark) antes da 1ª pintura. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=localStorage.getItem('enky-theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=(p==='system'?(d?'dark':'light'):p);}catch(e){document.documentElement.dataset.theme='dark';}})();",
          }}
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
