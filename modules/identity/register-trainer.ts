import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { normalizeEmail } from "./normalize-email";
import { passwordSchema } from "./password-policy";

export const registerTrainerInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email(),
  password: passwordSchema,
});

export type RegisterTrainerInput = z.infer<typeof registerTrainerInputSchema>;

export interface RegisterTrainerContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterTrainerResult {
  userId: string;
  organizationId: string;
  sessionToken: string;
  sessionExpiresAt: Date;
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "treinador"
  );
}

// Implements the atomic creation pattern from ADR-001: User + TrainerProfile
// + personal Organization + OrganizationMembership(OWNER) in one transaction.
export async function registerTrainer(
  input: RegisterTrainerInput,
  context: RegisterTrainerContext = {},
): Promise<RegisterTrainerResult> {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    throw new ConflictError("Já existe uma conta com este e-mail.");
  }

  const passwordHash = await hashPassword(input.password);

  let user: { id: string };
  let organization: { id: string };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, name: input.name, passwordHash, globalRole: "TRAINER" },
      });
      await tx.trainerProfile.create({ data: { userId: createdUser.id } });

      const baseSlug = slugify(input.name);
      let slug = baseSlug;
      let attempt = 1;
      // Slug must be globally unique; retry with a numeric suffix on
      // collision rather than trusting a single guess inside the transaction.
      while (await tx.organization.findUnique({ where: { slug } })) {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
      }

      const createdOrganization = await tx.organization.create({
        data: { name: input.name, slug },
      });
      await tx.organizationMembership.create({
        data: { userId: createdUser.id, organizationId: createdOrganization.id, role: "OWNER" },
      });

      await recordAuditLog(tx, {
        action: "REGISTER_TRAINER",
        entityName: "User",
        entityId: createdUser.id,
        userId: createdUser.id,
        organizationId: createdOrganization.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return { user: createdUser, organization: createdOrganization };
    });
    user = result.user;
    organization = result.organization;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe uma conta com este e-mail.");
    }
    throw error;
  }

  const session = await createSession({
    userId: user.id,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  return {
    userId: user.id,
    organizationId: organization.id,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}
