// Formas de resposta das rotas /api/admin/*. Datas chegam como string (JSON),
// não Date — o serviço devolve Date, a serialização converte.

export interface PlatformStats {
  trainers: number;
  athletes: number;
  organizations: number;
  activeOrganizations: number;
  users: number;
  activeUsers: number;
  blockedUsers: number;
  usersActiveLast30Days: number;
  athletesPerTrainerAvg: number;
  athletesPerTrainerMax: number;
  workouts: number;
  workoutsCompleted: number;
  pendingInvitations: number;
  reports: number;
  auditEvents: number;
  activeSubscriptions: number;
  delinquentSubscriptions: number;
  mrr: number;
  webhooksProcessed: number;
  webhooksFailed: number;
}

export interface OrganizationRef {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  globalRole: string;
  isActive: boolean;
  createdAt: string;
  organizations: OrganizationRef[];
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  trainers: number;
  athletes: number;
  workouts: number;
  planName: string | null;
  subscriptionStatus: string | null;
}

export interface AdminTrainer {
  id: string;
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  crefCode: string | null;
  createdAt: string;
  organization: OrganizationRef | null;
  athletes: number;
  workouts: number;
}

export type AdminAthleteStatus = "ACTIVE" | "BLOCKED" | "PENDING_INVITE";

export interface AdminAthlete {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  status: AdminAthleteStatus;
  createdAt: string;
  organization: OrganizationRef | null;
  trainerName: string | null;
  workouts: number;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entityName: string;
  entityId: string | null;
  createdAt: string;
  actorType: string;
  reason: string | null;
  user: { name: string; email: string } | null;
  organization: { id: string; name: string } | null;
}

export interface OrganizationDetail {
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    isActive: boolean;
    createdAt: string;
  };
  subscription: {
    id: string;
    status: string;
    planName: string;
    planPrice: number;
    billingCycle: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt: string | null;
  } | null;
  members: {
    userId: string;
    name: string;
    email: string;
    globalRole: string;
    isActive: boolean;
    organizationRole: string;
  }[];
  athletes: {
    id: string;
    name: string;
    email: string | null;
    isActive: boolean;
    trainerName: string;
  }[];
  counts: {
    trainers: number;
    athletes: number;
    workouts: number;
    workoutsCompleted: number;
    pendingInvitations: number;
    reports: number;
  };
}
