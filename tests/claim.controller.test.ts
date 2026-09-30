import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Ticket claim concurrency", () => {
  beforeEach(async () => {
    await prisma.aiClassification.deleteMany();
    await prisma.ticket.deleteMany();
  });

  it("allows only one agent to claim the same ticket concurrently", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        externalId: "CONCURRENT-CLAIM-001",
        customerId: "C-TEST",
        customerPlan: "pro",
        subject: "Cannot login",
        body: "I cannot log in",
        createdAt: new Date(),
        status: "open",
      },
    });

    const [agent1, agent2] = await Promise.all([
      request(app)
        .post(`/tickets/${ticket.id}/claim`)
        .send({ agent_id: "agent-1" }),

      request(app)
        .post(`/tickets/${ticket.id}/claim`)
        .send({ agent_id: "agent-2" }),
    ]);

    const statuses = [agent1.status, agent2.status].sort();

    expect(statuses).toEqual([200, 409]);

    const claimedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    expect(claimedTicket?.claimedBy).toBeTruthy();
    expect(["agent-1", "agent-2"]).toContain(claimedTicket?.claimedBy);
  });
});