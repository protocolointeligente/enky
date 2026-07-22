import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit carrega as métricas das fontes padrão (.afm) do próprio pacote via
  // require dinâmico, que o bundler do Next não enxerga. Mantê-lo externo e
  // puxar os assets de marca para o trace evita o PDF quebrar só em produção
  // (Fase 8 — modules/reports/report-pdf.ts).
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/trainer/reports/**": ["./public/brand/**", "./node_modules/pdfkit/js/data/**"],
    "/api/athlete/reports/**": ["./public/brand/**", "./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
