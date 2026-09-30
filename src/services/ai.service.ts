import {
  TicketCategory,
  TicketPriority,
  TriageDecision,
} from "../generated/prisma/enums";
export interface AiClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  summary: string;
  tokenUsage?: number;
  model?: string;
  durationMs?: number;
}

export interface AiProvider {
  classify(input: {
    customerPlan: string;
    subject: string;
    body: string;
  }): Promise<AiClassificationResult>;
}

export interface TriageResult {
  decision: TriageDecision;
  reviewReason?: string;
}