export interface InvitationEmailPayload {
  to: string;
  athleteName?: string | null;
  trainerName: string;
  activationUrl: string;
  expiresAt: Date;
}

export interface InvitationMailer {
  sendInvitation(payload: InvitationEmailPayload): Promise<void>;
}
