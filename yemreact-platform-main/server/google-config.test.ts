import { describe, expect, it } from "vitest";

describe("Google OAuth configuration", () => {
  it("يقبل معرف العميل ويستطيع تكوين طلب OpenID نحو مزود Google", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toMatch(/^[0-9][0-9A-Za-z-]*\.apps\.googleusercontent\.com$/);

    const discovery = await fetch("https://accounts.google.com/.well-known/openid-configuration");
    expect(discovery.ok).toBe(true);
    const config = (await discovery.json()) as { issuer?: string; authorization_endpoint?: string };
    expect(config.issuer).toBe("https://accounts.google.com");
    expect(config.authorization_endpoint).toContain("accounts.google.com");

    const authorizationUrl = new URL(config.authorization_endpoint!);
    authorizationUrl.searchParams.set("client_id", clientId!);
    authorizationUrl.searchParams.set("response_type", "id_token");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(clientId);
  });
});
