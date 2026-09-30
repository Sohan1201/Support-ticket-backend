import {
  TicketCategory,
  TicketPriority,
  TriageDecision,
} from "../generated/prisma/enums";

import {
  AiClassificationResult,
  TriageResult,
} from "./ai.service";

const validCategories = new Set<TicketCategory>([
  TicketCategory.billing,
  TicketCategory.bug,
  TicketCategory.account_access,
  TicketCategory.feature_request,
  TicketCategory.other,
]);

const validPriorities = new Set<TicketPriority>([
  TicketPriority.P0,
  TicketPriority.P1,
  TicketPriority.P2,
  TicketPriority.P3,
]);

export function checkAiResult(
  result: AiClassificationResult,
  customerPlan: string,
): TriageResult {
  if (!validCategories.has(result.category)) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "AI returned an invalid category",
    };
  }

  if (!validPriorities.has(result.priority)) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "AI returned an invalid priority",
    };
  }

  if (
    typeof result.summary !== "string" ||
    result.summary.trim().length === 0
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "AI returned an invalid summary",
    };
  }

  if (result.summary.trim().split(/\s+/).length > 25) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "AI summary exceeds 25 words",
    };
  }

  if (
    customerPlan === "enterprise" &&
    result.priority !== TicketPriority.P0 &&
    result.priority !== TicketPriority.P1
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "Enterprise ticket was assigned below P1",
    };
  }

  return {
    decision: TriageDecision.auto_accept,
  };
}