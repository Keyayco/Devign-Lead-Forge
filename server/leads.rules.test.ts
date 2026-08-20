import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

vi.mock("./db", () => ({
  claimLead: vi.fn(),
  createLead: vi.fn(),
  deleteLead: vi.fn(),
  getLeadById: vi.fn(),
  getLeadWithClaimer: vi.fn(),
  listLeads: vi.fn(),
  updateLead: vi.fn(),
}));

const AGENT_ONE = "11111111-1111-4111-8111-111111111111";
const AGENT_TWO = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "77777777-7777-4777-8777-777777777777";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const rawLead = {
  id: LEAD_ID,
  title: "Northstar Labs",
  company_name: "Northstar Labs",
  contact_name: "Maya Chen",
  contact_email: "maya@northstar.example",
  contact_phone: "+1 555 0102",
  source: "SaaS",
  status: "new",
  claimed_by: null as string | null,
  claimed_at: null as string | null,
  notes: "14 Market Street, Boston, MA\nDemo Link: https://northstar.example/demo",
  created_by_id: AGENT_ONE,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const baseLead = {
  id: LEAD_ID,
  name: "Northstar Labs",
  contact: "Maya Chen · +1 555 0102",
  email: "maya@northstar.example",
  address: "14 Market Street, Boston, MA",
  type: "SaaS",
  demoLink: "https://northstar.example/demo",
  claimedByUserId: null as string | null,
  claimedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  claimedByName: null,
  claimedByEmail: null,
};

function createContext(userId = AGENT_ONE): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    authUserId: userId,
    email: `agent-${userId.slice(-1)}@example.com`,
    name: `Agent ${userId.slice(-1)}`,
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    accessToken: `token-${userId}`,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const validInput = {
  name: "Northstar Labs",
  contact: "Maya Chen · +1 555 0102",
  email: "maya@northstar.example",
  address: "14 Market Street, Boston, MA",
  type: "SaaS",
  demoLink: "https://northstar.example/demo",
};

describe("lead access rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed lead input before touching the database", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.leads.create({ ...validInput, email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createLead).not.toHaveBeenCalled();
  });

  it("prevents another agent from updating a claimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({ ...rawLead, claimed_by: AGENT_TWO });
    const caller = appRouter.createCaller(createContext(AGENT_ONE));

    await expect(caller.leads.update({ id: LEAD_ID, ...validInput })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.updateLead).not.toHaveBeenCalled();
  });

  it("returns a conflict when a lead is already claimed", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({ ...rawLead, claimed_by: AGENT_TWO });
    const caller = appRouter.createCaller(createContext(AGENT_ONE));

    await expect(caller.leads.claim({ id: LEAD_ID })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.claimLead).not.toHaveBeenCalled();
  });

  it("allows an authenticated agent to claim an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(rawLead);
    vi.mocked(db.claimLead).mockResolvedValue(true);
    vi.mocked(db.getLeadWithClaimer).mockResolvedValue({
      ...baseLead,
      claimedByUserId: AGENT_ONE,
      claimedByName: "Agent 1",
    });
    const caller = appRouter.createCaller(createContext(AGENT_ONE));

    const result = await caller.leads.claim({ id: LEAD_ID });

    expect(db.claimLead).toHaveBeenCalledWith(`token-${AGENT_ONE}`, LEAD_ID);
    expect(result?.claimedByUserId).toBe(AGENT_ONE);
  });
});

describe("lead CRUD procedure paths", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists filtered leads for an authenticated agent", async () => {
    vi.mocked(db.listLeads).mockResolvedValue([baseLead]);
    const caller = appRouter.createCaller(createContext());
    const filters = { search: "Northstar", type: "all", claimStatus: "all" as const };

    const result = await caller.leads.list(filters);

    expect(db.listLeads).toHaveBeenCalledWith(filters);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Northstar Labs");
  });

  it("creates a valid lead for the authenticated profile", async () => {
    vi.mocked(db.createLead).mockResolvedValue(baseLead);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.create(validInput);

    expect(db.createLead).toHaveBeenCalledWith(AGENT_ONE, validInput);
    expect(result?.id).toBe(LEAD_ID);
  });

  it("updates an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(rawLead);
    vi.mocked(db.updateLead).mockResolvedValue({ ...baseLead, ...validInput });
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.update({ id: LEAD_ID, ...validInput });

    expect(db.updateLead).toHaveBeenCalledWith(LEAD_ID, validInput);
    expect(result?.name).toBe("Northstar Labs");
  });

  it("deletes an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(rawLead);
    vi.mocked(db.deleteLead).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.remove({ id: LEAD_ID });

    expect(db.deleteLead).toHaveBeenCalledWith(LEAD_ID);
    expect(result).toEqual({ success: true });
  });
});
