import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  TicketCategory,
  TicketPriority,
  TriageDecision,
} from "../src/generated/prisma/enums";
import { createTicket } from "../src/services/tickets.services";
import { FakeAiProvider } from "../src/services/fake.ai.provider";

describe("ticket creation service", () => {
  beforeEach(async () => {
    await prisma.aiClassification.deleteMany();
    await prisma.ticket.deleteMany();
  });

  it("auto-accepts a valid AI classification", async () => {
    const ai = new FakeAiProvider({
      category: TicketCategory.account_access,
      priority: TicketPriority.P2,
      summary: "Customer cannot log in to their account.",
      tokenUsage: 20,
      model: "fake-model",
      durationMs: 5,
    });

    const ticket = await createTicket(
      {
        external_id: "TEST-AUTO-001",
        customer_id: "C-1",
        customer_plan: "pro",
        subject: "Cannot login",
        body: "I cannot log in to my account.",
        created_at: new Date("2026-10-01T00:00:00Z"),
      },
      ai,
      150,
    );

    expect(ticket.triageDecision).toBe(TriageDecision.auto_accept);
    expect(ticket.category).toBe(TicketCategory.account_access);
    expect(ticket.priority).toBe(TicketPriority.P2);
    expect(ticket.slaDeadline).not.toBeNull();
  });

  it("sends enterprise tickets below P1 to manual review", async () => {
    const ai = new FakeAiProvider({
      category: TicketCategory.account_access,
      priority: TicketPriority.P2,
      summary: "Enterprise customer cannot log in.",
      tokenUsage: 20,
      model: "fake-model",
      durationMs: 5,
    });

    const ticket = await createTicket(
      {
        external_id: "TEST-MANUAL-001",
        customer_id: "C-2",
        customer_plan: "enterprise",
        subject: "SSO login failure",
        body: "Our team cannot log in using SSO.",
        created_at: new Date("2026-10-01T00:00:00Z"),
      },
      ai,
      150,
    );

    expect(ticket.triageDecision).toBe(TriageDecision.manual_review);
    expect(ticket.reviewReason).toBe(
      "enterprise_priority_violation",
    );
  });

  it("sends a suspicious category to manual review", async () => {
    const ai = new FakeAiProvider({
      category: TicketCategory.billing,
      priority: TicketPriority.P2,
      summary: "Customer cannot log in.",
      tokenUsage: 20,
      model: "fake-model",
      durationMs: 5,
    });

    const ticket = await createTicket(
      {
        external_id: "TEST-MANUAL-002",
        customer_id: "C-3",
        customer_plan: "pro",
        subject: "Cannot login",
        body: "My password is not working.",
        created_at: new Date("2026-10-01T00:00:00Z"),
      },
      ai,
      150,
    );

    expect(ticket.triageDecision).toBe(TriageDecision.manual_review);
    expect(ticket.reviewReason).toBe(
      "category_does_not_match_ticket",
    );
  });
});