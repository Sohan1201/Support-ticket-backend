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