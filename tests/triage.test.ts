import { describe, expect, it } from "vitest";
import { TicketCategory, TicketPriority, TriageDecision } 
from "../src/generated/prisma/enums";

import { checkAiResult } from "../src/services/triage.service";

describe("AI triage checker", () => {
  it("accepts a valid result", () => {
    const result = checkAiResult(
  {
    category: TicketCategory.account_access,
    priority: TicketPriority.P1,
    summary: "Customer cannot log in.",
  },
  "enterprise",
  "Cannot log in",
  "The customer cannot log in to their account.",
  );

    expect(result.decision).toBe(TriageDecision.auto_accept);
  });

  it("requires manual review when enterprise is below P1", () => {
    const result = checkAiResult(
      {
        category: TicketCategory.account_access,
        priority: TicketPriority.P2,
        summary: "Customer cannot log in using SSO.",
      },
      "enterprise",
    );

    expect(result.decision).toBe(TriageDecision.manual_review);
  });

  it("requires manual review for an overly long summary", () => {
    const result = checkAiResult(
      {
        category: TicketCategory.other,
        priority: TicketPriority.P2,
        summary:
          "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty one twenty two twenty three twenty four twenty five twenty six",
      },
      "pro",
    );

    expect(result.decision).toBe(TriageDecision.manual_review);
  });
});