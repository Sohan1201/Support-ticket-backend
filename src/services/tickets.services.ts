import { prisma } from "../lib/prisma";
import {
  CustomerPlan,
  TicketCategory,
  TicketPriority,
  TriageDecision,
} from "../generated/prisma/enums";
import { AiProvider } from "./ai.service";
import { runAiWithTimeout } from "./ai.runner.services";
import { checkAiResult } from "./triage.service";
import { calculateSlaDeadline } from "./sla.services";

const SAME_PROBLEM_WINDOW_MS = 10 * 60 * 1000;
const SAME_PROBLEM_THRESHOLD = 0.4;

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function similarity(a: string, b: string): number {
  const first = normalizeWords(a);
  const second = normalizeWords(b);

  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const word of first) {
    if (second.has(word)) {
      intersection++;
    }
  }

  return intersection / Math.min(first.size, second.size);
}

async function findParentTicket(
  customerId: string,
  subject: string,
  body: string,
  createdAt: Date,
): Promise<string | null> {
  const windowStart = new Date(
    createdAt.getTime() - SAME_PROBLEM_WINDOW_MS,
  );

  const candidates = await prisma.ticket.findMany({
    where: {
      customerId,
      createdAt: {
        gte: windowStart,
        lte: createdAt,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      subject: true,
      body: true,
    },
  });

  const currentText = `${subject} ${body}`;

  for (const candidate of candidates) {
    const candidateText = `${candidate.subject} ${candidate.body}`;

    if (similarity(currentText, candidateText) >= SAME_PROBLEM_THRESHOLD) {
      return candidate.id;
    }
  }

  return null;
}

export interface CreateTicketInput {
  external_id: string;
  customer_id: string;
  customer_plan: "free" | "pro" | "enterprise";
  subject: string;
  body: string;
  created_at: Date;
}

export async function createTicket(
  input: CreateTicketInput,
  aiProvider: AiProvider,
  aiTimeoutMs: number,
) {
  const parentTicketId = await findParentTicket(
    input.customer_id,
    input.subject,
    input.body,
    input.created_at,
  );

  let ticket;

  try {
    ticket = await prisma.ticket.create({
      data: {
        externalId: input.external_id,
        customerId: input.customer_id,
        customerPlan: input.customer_plan as CustomerPlan,
        subject: input.subject,
        body: input.body,
        createdAt: input.created_at,
        parentTicketId,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error("DUPLICATE_EXTERNAL_ID");
    }

    throw error;
  }

  const aiResult = await runAiWithTimeout(
    aiProvider,
    {
      customerPlan: input.customer_plan,
      subject: input.subject,
      body: input.body,
    },
    aiTimeoutMs,
  );

  if (aiResult.failed || !aiResult.classification) {
    await prisma.aiClassification.create({
      data: {
        ticketId: ticket.id,
        success: false,
        failureReason: aiResult.failureReason ?? "AI classification failed",
      },
    });

    return prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        triageDecision: TriageDecision.manual_review,
        reviewReason: aiResult.failureReason ?? "AI classification failed",
      },
    });
  }

  const classification = aiResult.classification;
  const triage = checkAiResult(
    classification,
    input.customer_plan,
  );

  await prisma.aiClassification.create({
    data: {
      ticketId: ticket.id,
      category: classification.category as TicketCategory,
      priority: classification.priority as TicketPriority,
      summary: classification.summary,
      tokenUsage: classification.tokenUsage,
      model: classification.model,
      durationMs: classification.durationMs,
      success: true,
    },
  });

  const deadline = calculateSlaDeadline(
    input.created_at,
    classification.priority,
  );

  return prisma.ticket.update({
    where: {
      id: ticket.id,
    },
    data: {
      category: classification.category,
      priority: classification.priority,
      summary: classification.summary,
      triageDecision: triage.decision,
      reviewReason: triage.reviewReason,
      slaDeadline: deadline,
    },
  });
}