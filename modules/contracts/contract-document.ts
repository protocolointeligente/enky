import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { ContractActor } from "./contract-service";

// Documento do contrato em HTML (§11). Sem assinatura digital avançada nesta
// etapa — o HTML é para visualização/impressão/exportação e registra o aceite
// manual já gravado no contrato. `templateCode`/`templateVersion` versionam o
// modelo para reconstruir depois exatamente o que foi apresentado.

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: unknown, currency: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

function day(value: Date | null | undefined): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

export interface ContractDocumentData {
  contract: {
    id: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    billingDay: number;
    price: unknown;
    discount: unknown;
    finalPrice: unknown;
    currency: string;
    autoRenew: boolean;
    gracePeriodDays: number;
    cancellationNoticeDays: number;
    templateCode: string | null;
    templateVersion: number | null;
    acceptedAt: Date | null;
    acceptedBy: string | null;
    acceptanceMethod: string | null;
  };
  organizationName: string;
  clientName: string;
  payerName: string;
  athleteName: string | null;
  planName: string;
}

// Render PURO — nenhuma consulta, tudo escapado. Fácil de testar/versionar.
export function renderContractHtml(d: ContractDocumentData): string {
  const c = d.contract;
  const acceptance = c.acceptedAt
    ? `<p>Aceito por <strong>${esc(c.acceptedBy)}</strong> em ${day(c.acceptedAt)} (${esc(
        c.acceptanceMethod,
      )}).</p>`
    : `<p><em>Contrato ainda não aceito.</em></p>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Contrato — ${esc(d.clientName)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin-top: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
  td { padding: 0.35rem 0; border-bottom: 1px solid #eee; }
  td:first-child { color: #666; width: 40%; }
  footer { margin-top: 2rem; font-size: 0.8rem; color: #888; }
</style></head><body>
<h1>Contrato de Prestação de Serviços</h1>
<p><strong>${esc(d.organizationName)}</strong> e <strong>${esc(d.clientName)}</strong>.</p>

<h2>Partes</h2>
<table>
  <tr><td>Contratante (cliente)</td><td>${esc(d.clientName)}</td></tr>
  <tr><td>Pagador</td><td>${esc(d.payerName)}</td></tr>
  <tr><td>Atleta</td><td>${esc(d.athleteName) || "—"}</td></tr>
</table>

<h2>Serviço</h2>
<table>
  <tr><td>Plano</td><td>${esc(d.planName)}</td></tr>
  <tr><td>Início</td><td>${day(c.startDate)}</td></tr>
  <tr><td>Término</td><td>${day(c.endDate)}</td></tr>
  <tr><td>Dia de vencimento</td><td>${c.billingDay}</td></tr>
  <tr><td>Renovação automática</td><td>${c.autoRenew ? "Sim" : "Não"}</td></tr>
</table>

<h2>Valores</h2>
<table>
  <tr><td>Preço</td><td>${money(c.price, c.currency)}</td></tr>
  <tr><td>Desconto</td><td>${money(c.discount, c.currency)}</td></tr>
  <tr><td>Valor final</td><td><strong>${money(c.finalPrice, c.currency)}</strong></td></tr>
</table>

<h2>Condições</h2>
<table>
  <tr><td>Carência (dias)</td><td>${c.gracePeriodDays}</td></tr>
  <tr><td>Aviso de cancelamento (dias)</td><td>${c.cancellationNoticeDays}</td></tr>
</table>

<h2>Aceite</h2>
${acceptance}

<footer>Modelo ${esc(c.templateCode)} v${c.templateVersion ?? 1} · Contrato ${esc(c.id)}</footer>
</body></html>`;
}

export async function getContractDocumentHtml(contractId: string, actor: ContractActor): Promise<string> {
  const contract = await prisma.coachClientContract.findFirst({
    where: { id: contractId, organizationId: actor.organizationId },
    include: {
      organization: { select: { name: true } },
      client: { select: { name: true } },
      payer: { select: { name: true } },
      athlete: { select: { user: { select: { name: true } } } },
      servicePlan: { select: { name: true } },
    },
  });
  if (!contract) throw new NotFoundError("Contrato não encontrado.");

  return renderContractHtml({
    contract,
    organizationName: contract.organization.name,
    clientName: contract.client.name,
    payerName: contract.payer.name,
    athleteName: contract.athlete?.user?.name ?? null,
    planName: contract.servicePlan.name,
  });
}
