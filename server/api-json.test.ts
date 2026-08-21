import { createServer, type AddressInfo } from "node:http";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createApp } from "./_core/index";

const AGENT_ONE = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "77777777-7777-4777-8777-777777777777";

const mocks = vi.hoisted(() => ({
  createLead: vi.fn(),
  claimLead: vi.fn(),
  deleteLead: vi.fn(),
  getLeadById: vi.fn(),
  getLeadWithClaimer: vi.fn(),
  listLeads: vi.fn(),
  updateLead: vi.fn(),
  getUserByAuthUserId: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    auth_user_id: "11111111-1111-4111-8111-111111111111",
    full_name: "Agent One",
    email: "agent@example.com",
    role: "user",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  upsertUser: vi.fn(),
  getBearerToken: vi.fn((req: { headers: Record<string, string | string[] | undefined> }) => {
    const header = req.headers.authorization;
    return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  }),
  getSupabaseUserFromRequest: vi.fn(async (req: { headers: Record<string, string | string[] | undefined> }) => {
    const header = req.headers.authorization;
    return typeof header === "string" && header.startsWith("Bearer ")
      ? { id: AGENT_ONE, email: "agent@example.com", user_metadata: { full_name: "Agent One" } }
      : null;
  }),
}));

vi.mock("./db", () => mocks);
vi.mock("./supabaseAuth", () => ({
  getBearerToken: mocks.getBearerToken,
  getSupabaseUserFromRequest: mocks.getSupabaseUserFromRequest,
}));

const validInput = {
  name: "Northstar Labs",
  contact: "Maya Chen · +1 555 0102",
  email: "maya@northstar.example",
  address: "14 Market Street, Boston, MA",
  type: "SaaS",
  demoLink: "https://northstar.example/demo",
};

const createdLead = {
  id: LEAD_ID,
  name: validInput.name,
  contact: validInput.contact,
  email: validInput.email,
  address: validInput.address,
  type: validInput.type,
  demoLink: validInput.demoLink,
  claimedByUserId: null,
  claimedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  claimedByName: null,
  claimedByEmail: null,
};

async function withAppServer<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = await createApp({ serveClient: false });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function postCreate(baseUrl: string, input: unknown, authenticated = true) {
  const response = await fetch(`${baseUrl}/api/trpc/leads.create?batch=1`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { authorization: "Bearer test-access-token" } : {}),
    },
    body: JSON.stringify({ 0: { json: input } }),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
}

describe("lead create API JSON boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON for an authenticated successful lead creation", async () => {
    mocks.createLead.mockResolvedValue(createdLead);

    const result = await withAppServer(baseUrl => postCreate(baseUrl, validInput));

    expect(result.status).toBe(200);
    expect(result.contentType).toContain("application/json");
    expect(() => JSON.parse(result.body)).not.toThrow();
    expect(mocks.createLead).toHaveBeenCalledWith(AGENT_ONE, validInput);
  });

  it("returns JSON for an unauthenticated request", async () => {
    const result = await withAppServer(baseUrl => postCreate(baseUrl, validInput, false));

    expect(result.status).toBe(401);
    expect(result.contentType).toContain("application/json");
    expect(() => JSON.parse(result.body)).not.toThrow();
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("returns JSON for invalid lead input", async () => {
    const result = await withAppServer(baseUrl => postCreate(baseUrl, { ...validInput, email: "not-an-email" }));

    expect(result.status).toBe(400);
    expect(result.contentType).toContain("application/json");
    expect(() => JSON.parse(result.body)).not.toThrow();
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("returns JSON when the database insert fails", async () => {
    mocks.createLead.mockRejectedValue(new Error("Supabase lead creation failed: insert denied"));

    const result = await withAppServer(baseUrl => postCreate(baseUrl, validInput));

    expect(result.status).toBe(500);
    expect(result.contentType).toContain("application/json");
    expect(() => JSON.parse(result.body)).not.toThrow();
  });
});
