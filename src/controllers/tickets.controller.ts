
import { prisma } from "../lib/prisma";
import { Request, Response } from "express";
import { createTicketSchema } from "../validators/ticket.validators";
import { createTicket } from "../services/tickets.services";
import { OpenAiProvider } from "../services/openai.provider";
import { calculateSlaDeadline } from "../services/sla.services";


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

export async function updateTicketStatusController(
  req: Request,
  res: Response,
) {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const { status } = req.body ?? {};

  const allowedStatuses = ["open", "in_progress", "resolved"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status",
    });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    const validTransition =
      (ticket.status === "open" && status === "in_progress") ||
      (ticket.status === "in_progress" && status === "resolved") ||
      (ticket.status === "resolved" && status === "open");

    if (!validTransition) {
      return res.status(409).json({
        error: `Invalid status transition: ${ticket.status} -> ${status}`,
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
      },
    });

    return res.status(200).json(updatedTicket);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to update ticket status",
    });
  }
}

export async function updateTicketTriageController(
  req: Request,
  res: Response,
) {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const { category, priority, reason } = req.body ?? {};

  if (
    (category === undefined && priority === undefined) ||
    typeof reason !== "string" ||
    reason.trim() === ""
  ) {
    return res.status(400).json({
      error: "category or priority and a written reason are required",
    });
  }

  const validCategories = [
    "billing",
    "bug",
    "account_access",
    "feature_request",
    "other",
  ];

  const validPriorities = ["P0", "P1", "P2", "P3"];

  if (category !== undefined && !validCategories.includes(category)) {
    return res.status(400).json({
      error: "Invalid category",
    });
  }

  if (priority !== undefined && !validPriorities.includes(priority)) {
    return res.status(400).json({
      error: "Invalid priority",
    });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        error: "Ticket not found",
      });
    }

    if (ticket.triageDecision !== "manual_review") {
      return res.status(409).json({
        error: "Ticket is not in manual review",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(category !== undefined ? { category } : {}),
        ...(priority !== undefined
          ? {
              priority,
              slaDeadline: calculateSlaDeadline(
                ticket.createdAt,
                priority,
              ),
            }
          : {}),
        triageDecision: "auto_accept",
        reviewReason: reason.trim(),
      },
    });

    return res.status(200).json(updatedTicket);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to update ticket triage",
    });
  }
}

export async function listTicketsController(req: Request, res: Response) {
  const {
    status,
    priority,
    category,
    triage_decision,
    cursor,
  } = req.query;

  const limitValue = Number(req.query.limit ?? 20);

  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
    return res.status(400).json({ error: "limit must be between 1 and 100" });
  }

  const validStatuses = ["open", "in_progress", "resolved"];
  const validPriorities = ["P0", "P1", "P2", "P3"];
  const validCategories = [
    "billing",
    "bug",
    "account_access",
    "feature_request",
    "other",
  ];
  const validTriageDecisions = ["auto_accept", "manual_review"];

  if (status !== undefined && !validStatuses.includes(String(status))) {
    return res.status(400).json({ error: "Invalid status" });
  }

  if (priority !== undefined && !validPriorities.includes(String(priority))) {
    return res.status(400).json({ error: "Invalid priority" });
  }

  if (category !== undefined && !validCategories.includes(String(category))) {
    return res.status(400).json({ error: "Invalid category" });
  }

  if (
    triage_decision !== undefined &&
    !validTriageDecisions.includes(String(triage_decision))
  ) {
    return res.status(400).json({ error: "Invalid triage_decision" });
  }

  let cursorDate: Date | undefined;
  let cursorId: string | undefined;

  if (cursor !== undefined) {
    try {
      const decoded = JSON.parse(
        Buffer.from(String(cursor), "base64url").toString("utf8"),
      );

      cursorDate = new Date(decoded.createdAt);
      cursorId = decoded.id;

      if (
        !cursorId ||
        Number.isNaN(cursorDate.getTime())
      ) {
        throw new Error("Invalid cursor");
      }
    } catch {
      return res.status(400).json({ error: "Invalid cursor" });
    }
  }

  const filters = {
    ...(status !== undefined
      ? { status: String(status) as any }
      : {}),
    ...(priority !== undefined
      ? { priority: String(priority) as any }
      : {}),
    ...(category !== undefined
      ? { category: String(category) as any }
      : {}),
    ...(triage_decision !== undefined
      ? { triageDecision: String(triage_decision) as any }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: {
      ...filters,
      ...(cursorDate && cursorId
        ? {
            OR: [
              { createdAt: { lt: cursorDate } },
              {
                createdAt: cursorDate,
                id: { lt: cursorId },
              },
            ],
          }
        : {}),
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limitValue + 1,
  });

  const hasMore = tickets.length > limitValue;
  const items = hasMore ? tickets.slice(0, limitValue) : tickets;

  let nextCursor: string | null = null;

  if (hasMore) {
    const last = items[items.length - 1];

    nextCursor = Buffer.from(
      JSON.stringify({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    ).toString("base64url");
  }

  return res.status(200).json({
    items,
    nextCursor,
  });
}

export async function getStatsController(_req: Request, res: Response) {
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
    where: {
      status: {
        not: "resolved",
      },
      priority: {
        not: null,
      },
      slaDeadline: {
        not: null,
      },
    },
    select: {
      priority: true,
      createdAt: true,
      slaDeadline: true,
    },
  });

  const stats = {
    P0: { late: 0, at_risk: 0, on_track: 0 },
    P1: { late: 0, at_risk: 0, on_track: 0 },
    P2: { late: 0, at_risk: 0, on_track: 0 },
    P3: { late: 0, at_risk: 0, on_track: 0 },
  };

  for (const ticket of tickets) {
    if (!ticket.priority || !ticket.slaDeadline) {
      continue;
    }

    const deadline = ticket.slaDeadline.getTime();
    const created = ticket.createdAt.getTime();
    const current = now.getTime();

    if (current >= deadline) {
      stats[ticket.priority].late++;
      continue;
    }

    const totalDuration = deadline - created;
    const remainingDuration = deadline - current;

    if (remainingDuration < totalDuration * 0.2) {
      stats[ticket.priority].at_risk++;
    } else {
      stats[ticket.priority].on_track++;
    }
  }

  return res.status(200).json(stats);
}