import type {
  InvitationEmailPayload,
  InvitationMailer,
} from "@/infrastructure/mail/invitation-mailer";

// Test double: records every invitation instead of sending it, so tests can
// assert on what would have been e-mailed (including the activation URL that
// a real inbox — absent in tests — would receive). Never used in production;
// the factory (get-invitation-mailer.ts) only ever returns Resend or Dev.
export class FakeInvitationMailer implements InvitationMailer {
  readonly sent: InvitationEmailPayload[] = [];

  async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    this.sent.push(payload);
  }

  get lastActivationUrl(): string | null {
    return this.sent.at(-1)?.activationUrl ?? null;
  }
}
