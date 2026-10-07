import type { OfflineLead } from "./offlineDb";

export type FlowPriority =
  | "NOW"
  | "NEXT"
  | "PREPARE"
  | "WAITING"
  | "COMPLETE"
  | "LOW";

export type FlowAction =
  | "FIRST OUTREACH"
  | "RESPOND"
  | "FOLLOW UP"
  | "SEND DEMO"
  | "BUILD DEMO"
  | "WAIT"
  | "COMPLETE"
  | "NO ACTION";

export type FlowDiagnostic = {
  outreach: number;
  demo: number;
  engagement: number;
  commercial: number;
  delivery: number;
};

export type FlowState = {
  priority: FlowPriority;
  recommendedAction: FlowAction;
  reason: string;
  diagnostic: FlowDiagnostic;
};

export function getDemoStatus(
  lead: Pick<OfflineLead, "demoLink" | "demoStatus">
): OfflineLead["demoStatus"] {
  return lead.demoStatus ?? (lead.demoLink.trim() ? "ready" : "none");
}

export function getOutreachStatus(
  lead: Pick<OfflineLead, "outreachStatus">
): OfflineLead["outreachStatus"] {
  return lead.outreachStatus ?? "not_started";
}

function diagnosticFor(lead: OfflineLead): FlowDiagnostic {
  const demoStatus = getDemoStatus(lead);
  const outreachStatus = getOutreachStatus(lead);
  return {
    outreach:
      outreachStatus === "contacted"
        ? 50
        : outreachStatus === "responded"
          ? 100
          : outreachStatus === "follow_up"
            ? 75
            : 0,
    demo:
      demoStatus === "building"
        ? 50
        : demoStatus === "ready" || demoStatus === "sent"
          ? 100
          : 0,
    // No response/event field exists in the current schema.
    engagement: 0,
    commercial:
      lead.status === "sold" ? 100 : lead.status === "pipeline" ? 60 : 0,
    // Delivery is not represented by the current lead model.
    delivery: 0,
  };
}

export function getFlowState(lead: OfflineLead): FlowState {
  const diagnostic = diagnosticFor(lead);
  const demoStatus = getDemoStatus(lead);
  const outreachStatus = getOutreachStatus(lead);

  // Existing status is the only reliable completion signal in the current model.
  if (lead.status === "sold") {
    return {
      priority: "COMPLETE",
      recommendedAction: "COMPLETE",
      reason: "The lead is marked Sold in the existing workflow.",
      diagnostic,
    };
  }

  if (outreachStatus === "responded") {
    return {
      priority: "NOW",
      recommendedAction: "RESPOND",
      reason: "The prospect has responded and needs attention.",
      diagnostic,
    };
  }

  if (demoStatus === "sent" && outreachStatus === "not_started") {
    return {
      priority: "NOW",
      recommendedAction: "FIRST OUTREACH",
      reason:
        "The demo has been sent but first outreach has not been recorded.",
      diagnostic,
    };
  }

  if (outreachStatus === "follow_up") {
    return {
      priority: "NEXT",
      recommendedAction: "FOLLOW UP",
      reason: "The prospect requires another follow-up.",
      diagnostic,
    };
  }

  if (demoStatus === "ready" && outreachStatus === "not_started") {
    return {
      priority: "NEXT",
      recommendedAction: "SEND DEMO",
      reason: "The demo is ready but has not yet been sent.",
      diagnostic,
    };
  }

  // The current schema cannot reliably distinguish worth pursuing, demo-ready,
  // contacted, responded, or follow-up-due states.
  return {
    priority: "LOW",
    recommendedAction: "NO ACTION",
    reason:
      "The current lead data does not identify a reliable next workflow action.",
    diagnostic,
  };
}

export function getFlowPriorityLabel(priority: FlowPriority): string {
  return priority === "LOW" ? "LOW / NO ACTION" : priority;
}
