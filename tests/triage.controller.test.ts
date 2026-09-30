import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Ticket triage update", () => {
  beforeEach(async () => {
    await prisma.aiClassification.deleteMany();
    await prisma.ticket.deleteMany();
  });

  it("allows an agent to change priority on a manual-review ticket and recalculates SLA", async () => {
    const createdAt = new Date("2026-09-20T09:00:00Z");

    const ticket = await prisma.ticket.create({
      data: {
        externalId: "TRIAGE-TEST-001",
        customerId: "C-TRIAGE",
        customerPlan: "pro",
        subject: "Something unclear",
        body: "Needs human review.",
        createdAt,
        category: "other",
        priority: "P3",
        triageDecision: "manual_review",
        reviewReason: "AI classification uncertain",
        slaDeadline: new Date("2026-09-23T09:00:00Z"),
      },
    });

    const response = await request(app)
      .patch(`/tickets/${ticket.id}/triage`)
      .send({
        priority: "P1",
        reason: "Agent confirmed this requires a faster response.",
      });

    expect(response.status).toBe(200);
    expect(response.body.priority).toBe("P1");
    expect(response.body.triageDecision).toBe("auto_accept");
    expect(response.body.reviewReason).toBe(
      "Agent confirmed this requires a faster response.",
    );
    expect(response.body.slaDeadline).toBe("2026-09-20T13:00:00.000Z");
  });

  it("rejects triage changes for an auto-accepted ticket", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: "TRIAGE-TEST-002",
        customerId: "C-TRIAGE",
        customerPlan: "pro",
        subject: "Billing issue",
        body: "I was charged twice.",
        createdAt: new Date("2026-09-20T09:00:00Z"),
        category: "billing",
        priority: "P2",
        triageDecision: "auto_accept",
      },
    });

    const response = await request(app)
      .patch(`/tickets/${ticket.id}/triage`)
      .send({
        priority: "P1",
        reason: "Agent wants to change priority.",
      });

    expect(response.status).toBe(409);
  });

  it("requires a written reason", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: "TRIAGE-TEST-003",
        customerId: "C-TRIAGE",
        customerPlan: "pro",
        subject: "Needs review",
        body: "Please investigate.",
        createdAt: new Date("2026-09-20T09:00:00Z"),
        category: "other",
        priority: "P2",
        triageDecision: "manual_review",
      },
    });

    const response = await request(app)
      .patch(`/tickets/${ticket.id}/triage`)
      .send({
        priority: "P1",
      });

    expect(response.status).toBe(400);
  });
});