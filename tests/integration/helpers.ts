import { randomUUID } from "node:crypto";

export function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@integration-test.enky.local`;
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
