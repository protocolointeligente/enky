import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENKY OS",
  description: "Human Performance Intelligence Platform — technical foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
