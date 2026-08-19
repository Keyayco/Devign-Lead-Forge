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

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const baseLead = {
  id: 7,
  name: "Northstar Labs",
  contact: "Maya Chen · +1 555 0102",
  email: "maya@northstar.example",
  address: "14 Market Street, Boston, MA",
  type: "SaaS",
  demoLink: "https://northstar.example/demo",
  claimedByUserId: null,
  claimedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  claimedByName: null,
  claimedByEmail: null,
};

function createContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    authUserId: `supabase-agent-${userId}`,
    email: `agent${userId}@example.com`,
    name: `Agent ${userId}`,
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed lead input before touching the database", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.leads.create({ ...validInput, email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createLead).not.toHaveBeenCalled();
  });

  it("prevents another agent from updating a claimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({
      ...baseLead,
      claimedByUserId: 99,
    });
    const caller = appRouter.createCaller(createContext(1));

    await expect(
      caller.leads.update({ id: 7, ...validInput }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateLead).not.toHaveBeenCalled();
  });

  it("returns a conflict when a lead is already claimed", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({
      ...baseLead,
      claimedByUserId: 99,
    });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.leads.claim({ id: 7 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.claimLead).not.toHaveBeenCalled();
  });

  it("allows an authenticated agent to claim an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(baseLead);
    vi.mocked(db.claimLead).mockResolvedValue(true);
    vi.mocked(db.getLeadWithClaimer).mockResolvedValue({
      ...baseLead,
      claimedByUserId: 1,
      claimedByName: "Agent 1",
    });
    const caller = appRouter.createCaller(createContext(1));

    const result = await caller.leads.claim({ id: 7 });

    expect(db.claimLead).toHaveBeenCalledWith(7, 1);
    expect(result?.claimedByUserId).toBe(1);
  });
});


describe("lead CRUD procedure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists filtered leads for an authenticated agent", async () => {
    vi.mocked(db.listLeads).mockResolvedValue([baseLead]);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.list({
      search: "Northstar",
      type: "all",
      claimStatus: "all",
    });

    expect(db.listLeads).toHaveBeenCalledWith({
      search: "Northstar",
      type: "all",
      claimStatus: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Northstar Labs");
  });

  it("creates a valid lead", async () => {
    vi.mocked(db.createLead).mockResolvedValue(baseLead);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.create(validInput);

    expect(db.createLead).toHaveBeenCalledWith(validInput);
    expect(result?.id).toBe(7);
  });

  it("updates an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(baseLead);
    vi.mocked(db.updateLead).mockResolvedValue({ ...baseLead, ...validInput });
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.update({ id: 7, ...validInput });

    expect(db.updateLead).toHaveBeenCalledWith(7, validInput);
    expect(result?.name).toBe("Northstar Labs");
  });

  it("deletes an unclaimed lead", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue(baseLead);
    vi.mocked(db.deleteLead).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.leads.remove({ id: 7 });

    expect(db.deleteLead).toHaveBeenCalledWith(7);
    expect(result).toEqual({ success: true });
  });
});
