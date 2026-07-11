import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPublicBaseUrl } from "@/lib/env";

// The activation-email bug: links pointed at http://localhost:3000 because
// APP_URL was unset on Vercel. getPublicBaseUrl must resolve the real
// deployment URL from Vercel's injected vars, with an explicit APP_URL winning.
const KEYS = ["APP_URL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

describe("getPublicBaseUrl", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key];
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("uses an explicit custom APP_URL and strips a trailing slash", () => {
    process.env.APP_URL = "https://app.enky.com.br/";
    expect(getPublicBaseUrl()).toBe("https://app.enky.com.br");
  });

  it("prefers the production domain on Vercel Production", () => {
    delete process.env.APP_URL;
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "enky.com.br";
    process.env.VERCEL_URL = "enky-abc123.vercel.app";
    expect(getPublicBaseUrl()).toBe("https://enky.com.br");
  });

  it("falls back to the deployment URL on a Preview deployment", () => {
    delete process.env.APP_URL;
    delete process.env.VERCEL_ENV;
    process.env.VERCEL_URL = "enky-git-feat-abc.vercel.app";
    expect(getPublicBaseUrl()).toBe("https://enky-git-feat-abc.vercel.app");
  });

  it("never returns localhost when a Vercel URL is present", () => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "enky-preview.vercel.app";
    expect(getPublicBaseUrl()).toBe("https://enky-preview.vercel.app");
  });
});
