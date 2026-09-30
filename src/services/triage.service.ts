import {
  TicketCategory,
  TicketPriority,
  TriageDecision,
} from "../generated/prisma/enums";

import { AiClassificationResult } from "./ai.service";

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

function containsAny(text: string, words: string[]): boolean {
  const normalized = text.toLowerCase();

  return words.some((word) => normalized.includes(word));
}

export function checkAiResult(
  result: AiClassificationResult,
  customerPlan: string,
  subject = "",
  body = "",
): TriageResult {
  if (!validCategories.has(result.category)) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "invalid_category",
    };
  }

  if (!validPriorities.has(result.priority)) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "invalid_priority",
    };
  }

  if (
    typeof result.summary !== "string" ||
    result.summary.trim().length === 0
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "invalid_summary",
    };
  }

  if (result.summary.trim().split(/\s+/).length > 25) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "summary_too_long",
    };
  }

  if (
    customerPlan === "enterprise" &&
    result.priority !== TicketPriority.P0 &&
    result.priority !== TicketPriority.P1
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "enterprise_priority_violation",
    };
  }
    if (subject.trim() === "" && body.trim() === "") {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "insufficient_ticket_content",
    };
  }

  const ticketText = `${subject} ${body}`.toLowerCase();

  const promptInjectionSignal = containsAny(ticketText, [
    "ignore all previous instructions",
    "ignore previous instructions",
    "ignore all prior instructions",
    "system prompt",
    "classify this ticket",
    "follow these instructions",
  ]);

  if (promptInjectionSignal) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "suspicious_customer_instruction",
    };
  }
 

  const billingSignal = containsAny(ticketText, [
  "bill",
  "billing",
  "refund",
  "charge",
  "payment",
  "invoice",
  "reembolso",
  "factura",
  "cargo",
  "cobro",
  "pago",
  "devolución",
  ]);

const accountSignal = containsAny(ticketText, [
  "login",
  "log in",
  "password",
  "account",
  "sign in",
  "sso",
]);

const featureSignal = containsAny(ticketText, [
  "feature",
  "request",
  "add support",
  "would like",
]);
  if (result.category === TicketCategory.billing && !billingSignal) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "category_does_not_match_ticket",
    };
  }

  if (
    result.category === TicketCategory.account_access &&
    !accountSignal
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "category_does_not_match_ticket",
    };
  }

  if (
    result.category === TicketCategory.feature_request &&
    !featureSignal
  ) {
    return {
      decision: TriageDecision.manual_review,
      reviewReason: "category_does_not_match_ticket",
    };
  }

  return {
    decision: TriageDecision.auto_accept,
  };
}

export interface TriageResult {
  decision: TriageDecision;
  reviewReason?: string;
}