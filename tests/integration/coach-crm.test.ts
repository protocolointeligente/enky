import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { createPlan } from "@/modules/coach-services/plan-service";
import { createLead } from "@/modules/crm/lead-service";
import { convertLead } from "@/modules/crm/convert-lead";
import { getClient } from "@/modules/clients/client-service";
import { getContract } from "@/modules/contracts/contract-service";
import {
  generateContractInvoices,
  getInvoice,
  listInvoices,
  registerPayment,
} from "@/modules/coach-billing/invoice-service";
import { listDelinquency } from "@/modules/coach-finance/finance-service";
import { assignAthlete, listTrainers, transferAthlete } from "@/modules/coach-team/team-service";
import { addMembers, createGroup, getGroup } from "@/modules/coach-groups/group-service";
import { NotFoundError } from "@/domain/errors";
import { uniqueEmail } from "./helpers";

// §34 — integração do CRM/gestão comercial. Exercita as orquestrações
// transacionais contra o Postgres real: conversão de lead, idempotência de
// geração de faturas, reconciliação de pagamento, inadimplência, carteira e o
// isolamento multi-tenant. Cria dados isolados (e-mails únicos) e limpa tudo.

const VALID_PASSWORD = "correcthorse1";
const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

async function newTrainer(prefix: string) {
  const result = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(result.userId);
  createdOrganizationIds.push(result.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId: result.userId } });
  createdTrainerProfileIds.push(trainerProfile.id);
  return { ...result, trainerProfileId: trainerProfile.id };
}

// Segundo treinador DENTRO de uma org existente (a gestão de membros existentes;
// o convite de treinador novo é multi-org, fora desta etapa) — criado direto.
async function addTrainerToOrg(organizationId: string, prefix: string) {
  const user = await prisma.user.create({
    data: { name: `${prefix} Coach`, email: uniqueEmail(prefix), globalRole: "TRAINER", isActive: true },
  });
  createdUserIds.push(user.id);
  const tp = await prisma.trainerProfile.create({ data: { userId: user.id } });
  createdTrainerProfileIds.push(tp.id);
  await prisma.organizationMembership.create({
    data: { userId: user.id, organizationId, role: "COACH" },
  });
  return { userId: user.id, trainerProfileId: tp.id };
}

function actor(t: { userId: string; organizationId: string }) {
  return { userId: t.userId, organizationId: t.organizationId };
}

describe("Etapa 4 — CRM/gestão comercial (integração)", () => {
  it("converte um lead ponta a ponta: cliente + contrato ACTIVE + 1ª fatura + lead WON", async () => {
    const t = await newTrainer("crm-flow");
    const plan = await createPlan(
      { name: "Corrida Online", billingType: "RECURRING", billingInterval: "MONTHLY", price: 200 },
      actor(t),
    );
    const lead = await createLead({ name: "João Prospect", email: uniqueEmail("lead") }, actor(t));

    const conv = await convertLead(
      lead.id,
      { servicePlanId: plan.id, startDate: new Date("2026-03-10"), billingDay: 10, generateFirstInvoice: true },
      actor(t),
    );
    expect(conv.alreadyConverted).toBe(false);
    expect(conv.contractId).toBeTruthy();
    expect(conv.invoiceCreated).toBe(true);

    const client = await getClient(conv.clientId, actor(t));
    expect(client.sourceLead?.id).toBe(lead.id);

    const contract = await getContract(conv.contractId!, actor(t));
    expect(contract.status).toBe("ACTIVE");
    expect(Number(contract.finalPrice)).toBe(200);

    const reloaded = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(reloaded.status).toBe("WON");
    expect(reloaded.convertedAt).not.toBeNull();
  });

  it("conversão é idempotente pelo sourceLead (não duplica cliente)", async () => {
    const t = await newTrainer("crm-idem");
    const plan = await createPlan(
      { name: "Plano", billingType: "RECURRING", billingInterval: "MONTHLY", price: 100 },
      actor(t),
    );
    const lead = await createLead({ name: "Repetido" }, actor(t));
    const first = await convertLead(lead.id, { servicePlanId: plan.id }, actor(t));
    const second = await convertLead(lead.id, { servicePlanId: plan.id }, actor(t));

    expect(second.alreadyConverted).toBe(true);
    expect(second.clientId).toBe(first.clientId);
    const count = await prisma.client.count({ where: { organizationId: t.organizationId, sourceLeadId: lead.id } });
    expect(count).toBe(1);
  });

  it("gera mensalidades idempotentes e reconcilia pagamento total/parcial", async () => {
    const t = await newTrainer("crm-bill");
    const plan = await createPlan(
      { name: "Mensal", billingType: "RECURRING", billingInterval: "MONTHLY", price: 300 },
      actor(t),
    );
    const lead = await createLead({ name: "Pagante" }, actor(t));
    const conv = await convertLead(
      lead.id,
      { servicePlanId: plan.id, startDate: new Date("2026-01-05"), billingDay: 5 },
      actor(t),
    );

    const gen1 = await generateContractInvoices(
      { contractId: conv.contractId!, fromDate: new Date("2026-01-01"), toDate: new Date("2026-03-31") },
      actor(t),
    );
    expect(gen1.created).toBe(3); // jan, fev, mar
    const gen2 = await generateContractInvoices(
      { contractId: conv.contractId!, fromDate: new Date("2026-01-01"), toDate: new Date("2026-03-31") },
      actor(t),
    );
    expect(gen2.created).toBe(0); // idempotente

    const { invoices } = await listInvoices({ contractId: conv.contractId! }, actor(t));
    const inv = invoices[0]!;

    const partial = await registerPayment(inv.id, { amount: 100, method: "PIX" }, actor(t));
    expect(partial.status).toBe("PARTIALLY_PAID");
    const full = await registerPayment(inv.id, { amount: 200, method: "CASH" }, actor(t));
    expect(full.status).toBe("PAID");

    const detail = await getInvoice(inv.id, actor(t));
    expect(detail.payments).toHaveLength(2);
  });

  it("lista inadimplência com faixa de atraso para faturas vencidas", async () => {
    const t = await newTrainer("crm-delinq");
    const plan = await createPlan(
      { name: "Atrasável", billingType: "RECURRING", billingInterval: "MONTHLY", price: 150 },
      actor(t),
    );
    const lead = await createLead({ name: "Devedor" }, actor(t));
    const conv = await convertLead(
      lead.id,
      { servicePlanId: plan.id, startDate: new Date("2020-01-01"), billingDay: 1 },
      actor(t),
    );
    await generateContractInvoices(
      { contractId: conv.contractId!, fromDate: new Date("2020-01-01"), toDate: new Date("2020-01-31") },
      actor(t),
    );

    const delinquency = await listDelinquency(actor(t));
    const mine = delinquency.items.filter((i) => i.clientName === "Devedor");
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0]!.bucket).toBe("60+");
    expect(mine[0]!.remaining).toBe(150);
  });

  it("carteira: atribui e transfere atleta entre treinadores da org", async () => {
    const t = await newTrainer("crm-carteira");
    const second = await addTrainerToOrg(t.organizationId, "crm-carteira2");
    const invite = await inviteAthlete(
      { email: uniqueEmail("carteira-ath") },
      { userId: t.userId, trainerProfileId: t.trainerProfileId, organizationId: t.organizationId },
    );
    createdAthleteProfileIds.push(invite.athleteProfileId);

    // inviteAthlete já criou o vínculo com o treinador dono; transfere p/ o 2º.
    await transferAthlete(
      { athleteId: invite.athleteProfileId, fromTrainerId: t.trainerProfileId, toTrainerId: second.trainerProfileId },
      { userId: t.userId, organizationId: t.organizationId },
    );

    const trainers = await listTrainers(actor(t));
    const secondRow = trainers.trainers.find((x) => x.trainerProfileId === second.trainerProfileId);
    expect(secondRow?.activeAthletes).toBe(1);

    // Reatribuir explicitamente com papel ASSISTANT ao dono.
    const rel = await assignAthlete(
      { trainerId: t.trainerProfileId, athleteId: invite.athleteProfileId, role: "ASSISTANT" },
      { userId: t.userId, organizationId: t.organizationId },
    );
    expect(rel.role).toBe("ASSISTANT");
  });

  it("grupo: cria e adiciona atleta (idempotente)", async () => {
    const t = await newTrainer("crm-grupo");
    const invite = await inviteAthlete(
      { email: uniqueEmail("grupo-ath") },
      { userId: t.userId, trainerProfileId: t.trainerProfileId, organizationId: t.organizationId },
    );
    createdAthleteProfileIds.push(invite.athleteProfileId);

    const group = await createGroup({ name: "Corrida Iniciante" }, actor(t));
    const add1 = await addMembers(group.id, { athleteIds: [invite.athleteProfileId] }, actor(t));
    expect(add1.added).toBe(1);
    const add2 = await addMembers(group.id, { athleteIds: [invite.athleteProfileId] }, actor(t));
    expect(add2.added).toBe(0); // @@unique + skipDuplicates

    const detail = await getGroup(group.id, actor(t));
    expect(detail.members).toHaveLength(1);
  });

  it("tenant isolation: outra org não acessa cliente/contrato/fatura", async () => {
    const a = await newTrainer("crm-tenant-a");
    const b = await newTrainer("crm-tenant-b");
    const plan = await createPlan(
      { name: "A-plano", billingType: "ONE_TIME", price: 500 },
      actor(a),
    );
    const lead = await createLead({ name: "Cliente A" }, actor(a));
    const conv = await convertLead(lead.id, { servicePlanId: plan.id, generateFirstInvoice: true }, actor(a));

    await expect(getClient(conv.clientId, actor(b))).rejects.toThrow(NotFoundError);
    await expect(getContract(conv.contractId!, actor(b))).rejects.toThrow(NotFoundError);
    const bInvoices = await listInvoices({}, actor(b));
    expect(bInvoices.invoices.every((i) => i.client.name !== "Cliente A")).toBe(true);
  });

  afterAll(async () => {
    const orgs = createdOrganizationIds;
    if (orgs.length > 0) {
      // Ordem de dependência: baixas → faturas → contratos → grupos → leads →
      // clientes → planos → vínculos → convites → auditoria. Só então a org.
      await prisma.coachPayment.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachInvoice.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachClientContract.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachGroupMember.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachGroup.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.communicationLog.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.leadInteraction.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.lead.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.client.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachServicePlan.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.coachAthleteRelationship.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.athleteInvitation.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    if (orgs.length > 0) {
      await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    if (createdTrainerProfileIds.length > 0) {
      await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
    }
    if (createdAthleteProfileIds.length > 0) {
      await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteProfileIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });
});
