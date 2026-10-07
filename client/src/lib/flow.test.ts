import { describe, expect, it } from "vitest";
import { getFlowPriorityLabel, getFlowState } from "./flow";
import type { OfflineLead } from "./offlineDb";

const baseLead: OfflineLead = {
  id: "lead-1",
  name: "Example Co",
  contact: "Alex",
  email: "alex@example.com",
  address: "",
  type: "SaaS",
  demoLink: "",
  demoStatus: "none",
  outreachStatus: "not_started",
  notes: "",
  status: "finessing",
  claimedByUserId: null,
  claimedByName: null,
  claimedByEmail: null,
  createdAt: null,
  updatedAt: null,
};

describe("FLOW state calculation", () => {
  it("prioritizes send demo when a demo is ready", () => {
    const result = getFlowState({
      ...baseLead,
      demoLink: "https://demo.example.com",
      demoStatus: "ready",
    });

    expect(result.priority).toBe("NEXT");
    expect(result.recommendedAction).toBe("SEND DEMO");
    expect(result.reason).toContain("ready");
    expect(result.diagnostic).toEqual({
      outreach: 0,
      demo: 100,
      engagement: 0,
      commercial: 0,
      delivery: 0,
    });
  });

  it("uses the strongest deterministic rule when a sold lead also has a demo", () => {
    const result = getFlowState({
      ...baseLead,
      demoLink: "https://demo.example.com",
      demoStatus: "sent",
      status: "sold",
    });

    expect(result.priority).toBe("COMPLETE");
    expect(result.recommendedAction).toBe("COMPLETE");
    expect(result.diagnostic.commercial).toBe(100);
  });

  it("represents a building demo without inventing a next action", () => {
    const result = getFlowState({ ...baseLead, demoStatus: "building" });

    expect(result.priority).toBe("LOW");
    expect(result.recommendedAction).toBe("NO ACTION");
    expect(result.diagnostic.demo).toBe(50);
  });

  it("does not treat a sent demo as proof of outreach", () => {
    const result = getFlowState({
      ...baseLead,
      demoLink: "https://demo.example.com",
      demoStatus: "sent",
    });

    expect(result.priority).toBe("NOW");
    expect(result.recommendedAction).toBe("FIRST OUTREACH");
    expect(result.reason).toContain("first outreach has not been recorded");
    expect(result.diagnostic.demo).toBe(100);
  });

  it("does not invent follow-up, response, or build-demo evidence", () => {
    const result = getFlowState(baseLead);

    expect(result.priority).toBe("LOW");
    expect(result.recommendedAction).toBe("NO ACTION");
    expect(result.diagnostic).toEqual({
      outreach: 0,
      demo: 0,
      engagement: 0,
      commercial: 0,
      delivery: 0,
    });
  });

  it("conservatively treats legacy demo links as ready", () => {
    const legacyLead = { ...baseLead, demoLink: "https://demo.example.com" };
    delete (legacyLead as Partial<OfflineLead>).demoStatus;

    const result = getFlowState(legacyLead);

    expect(result.recommendedAction).toBe("SEND DEMO");
    expect(result.diagnostic.demo).toBe(100);
  });

  it("prioritizes respond for an explicit response", () => {
    const result = getFlowState({
      ...baseLead,
      demoStatus: "sent",
      outreachStatus: "responded",
    });

    expect(result.priority).toBe("NOW");
    expect(result.recommendedAction).toBe("RESPOND");
    expect(result.diagnostic.outreach).toBe(100);
  });

  it("prioritizes follow-up for an explicit follow-up state", () => {
    const result = getFlowState({
      ...baseLead,
      demoStatus: "sent",
      outreachStatus: "follow_up",
    });

    expect(result.priority).toBe("NEXT");
    expect(result.recommendedAction).toBe("FOLLOW UP");
    expect(result.diagnostic.outreach).toBe(75);
  });

  it("does not call a contacted lead first outreach", () => {
    const result = getFlowState({
      ...baseLead,
      demoStatus: "sent",
      outreachStatus: "contacted",
    });

    expect(result.recommendedAction).not.toBe("FIRST OUTREACH");
    expect(result.diagnostic.outreach).toBe(50);
  });

  it("defaults legacy leads without outreach data to not started", () => {
    const legacyLead = { ...baseLead };
    delete (legacyLead as Partial<OfflineLead>).outreachStatus;

    const result = getFlowState({ ...legacyLead, demoStatus: "sent" });

    expect(result.recommendedAction).toBe("FIRST OUTREACH");
    expect(result.diagnostic.outreach).toBe(0);
  });

  it("labels the safe fallback clearly", () => {
    expect(getFlowPriorityLabel("LOW")).toBe("LOW / NO ACTION");
    expect(getFlowPriorityLabel("NEXT")).toBe("NEXT");
  });
});
