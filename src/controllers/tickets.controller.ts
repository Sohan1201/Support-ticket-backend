
import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { createTicketSchema } from "../validators/ticket.validators";
import { createTicket } from "../services/tickets.services";
import { OpenAiProvider } from "../services/openai.provider";

const aiProvider = new OpenAiProvider();

export async function createTicketController(
  req: Request,
  res: Response,
) {
  const parsed = createTicketSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid ticket data",
      details: parsed.error.flatten(),
    });
  }

  try {
    const ticket = await createTicket(
      parsed.data,
      aiProvider,
      Number(process.env.AI_TIMEOUT_MS ?? 150),
    );

    return res.status(201).json(ticket);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DUPLICATE_EXTERNAL_ID"
    ) {
      return res.status(409).json({
        error: "A ticket with this external_id already exists",
      });
    }

    console.error(error);

    return res.status(500).json({
      error: "Failed to create ticket",
    });
  }
}

export async function claimTicketController(
  req: Request,
  res: Response,
) {
  const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;
  const agentId = req.body?.agent_id;

  if (typeof agentId !== "string" || agentId.trim() === "") {
    return res.status(400).json({
      error: "agent_id is required",
    });
  }

  try {
    const ticket = await prisma.ticket.updateMany({
      where: {
        id,
        status: "open",
        claimedBy: null,
      },
      data: {
        claimedBy: agentId,
        claimedAt: new Date(),
      },
    });

    if (ticket.count === 0) {
      const existing = await prisma.ticket.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          claimedBy: true,
        },
      });

      if (!existing) {
        return res.status(404).json({
          error: "Ticket not found",
        });
      }

      return res.status(409).json({
        error: "Ticket has already been claimed or is not open",
      });
    }

    const claimed = await prisma.ticket.findUnique({
      where: { id },
    });

    return res.status(200).json(claimed);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to claim ticket",
    });
  }
}