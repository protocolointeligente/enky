import { afterEach, describe, expect, it } from "vitest";
import { assertTrustedOrigin } from "@/server/security/csrf";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

afterEach(() => {
  delete process.env.VERCEL_URL;
});

describe("server/security/csrf", () => {
  it("allows a request with a matching Origin header", () => {
    expect(() =>
      assertTrustedOrigin(makeRequest({ origin: "http://localhost:3000" })),
    ).not.toThrow();
  });

  it("allows a request with a matching Referer header when Origin is absent", () => {
    expect(() =>
      assertTrustedOrigin(makeRequest({ referer: "http://localhost:3000/some/page" })),
    ).not.toThrow();
  });

  it("rejects a request with a mismatched Origin", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://evil.example" }))).toThrow();
  });

  it("rejects a request with no Origin and no Referer", () => {
    expect(() => assertTrustedOrigin(makeRequest({}))).toThrow();
  });

  it("rejects a malformed Origin header", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "not-a-url" }))).toThrow();
  });

  it("allows a request whose Origin matches VERCEL_URL (Preview Deployment)", () => {
    process.env.VERCEL_URL = "enky-git-feat-abc123.vercel.app";
    expect(() =>
      assertTrustedOrigin(makeRequest({ origin: "https://enky-git-feat-abc123.vercel.app" })),
    ).not.toThrow();
  });

  it("still rejects an unrelated origin even when VERCEL_URL is set", () => {
    process.env.VERCEL_URL = "enky-git-feat-abc123.vercel.app";
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://evil.example" }))).toThrow();
  });
});
