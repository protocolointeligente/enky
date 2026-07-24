import { prisma } from "@/infrastructure/database/prisma";
import { CLIENT_READ_ROLES } from "@/modules/clients/client-service";
import { INVOICE_READ_ROLES } from "@/modules/coach-billing/invoice-service";
import { CONTRACT_READ_ROLES } from "@/modules/contracts/contract-service";
import { LEAD_READ_ROLES } from "@/modules/crm/lead-service";
import { toCsv } from "./csv";

// Exportação CSV (§27). Só dados COMERCIAIS — dados de saúde/fisiológicos nunca
// entram aqui (as entidades exportadas não os contêm). Cada export declara os
// papéis org que podem baixá-lo (mesma leitura da entidade).

export interface ExportActor {
  userId: string;
  organizationId: string;
}

function day(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
function num(v: unknown): number {
  return Number(v ?? 0);
}

export const EXPORTS = {
  leads: {
    roles: LEAD_READ_ROLES,
    async build(actor: ExportActor): Promise<string> {
      const rows = await prisma.lead.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" },
      });
      return toCsv(
        ["Nome", "E-mail", "Telefone", "Origem", "Status", "Valor estimado", "Criado em"],
        rows.map((l) => [l.name, l.email, l.phone, l.source, l.status, num(l.estimatedValue), day(l.createdAt)]),
      );
    },
  },
  clients: {
    roles: CLIENT_READ_ROLES,
    async build(actor: ExportActor): Promise<string> {
      const rows = await prisma.client.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" },
      });
      return toCsv(
        ["Nome", "E-mail", "Telefone", "Documento", "Status", "Criado em"],
        rows.map((c) => [c.name, c.email, c.phone, c.document, c.status, day(c.createdAt)]),
      );
    },
  },
  contracts: {
    roles: CONTRACT_READ_ROLES,
    async build(actor: ExportActor): Promise<string> {
      const rows = await prisma.coachClientContract.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" },
        include: { client: { select: { name: true } }, servicePlan: { select: { name: true } } },
      });
      return toCsv(
        ["Cliente", "Plano", "Status", "Valor final", "Início", "Término"],
        rows.map((c) => [c.client.name, c.servicePlan.name, c.status, num(c.finalPrice), day(c.startDate), day(c.endDate)]),
      );
    },
  },
  invoices: {
    roles: INVOICE_READ_ROLES,
    async build(actor: ExportActor): Promise<string> {
      const rows = await prisma.coachInvoice.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { dueDate: "desc" },
        include: { client: { select: { name: true } } },
      });
      return toCsv(
        ["Cliente", "Competência", "Vencimento", "Valor final", "Status"],
        rows.map((i) => [i.client.name, i.referencePeriod, day(i.dueDate), num(i.finalAmount), i.status]),
      );
    },
  },
} as const;

export type ExportEntity = keyof typeof EXPORTS;
export function isExportEntity(v: string): v is ExportEntity {
  return v in EXPORTS;
}
