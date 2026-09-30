import { TicketPriority } 
from "../generated/prisma/enums";

const SLA_HOURS: Record<TicketPriority, number> = {
  P0: 1,
  P1: 4,
  P2: 24,
  P3: 72,
};

export function calculateSlaDeadline(
  createdAt: Date,
  priority: TicketPriority,
): Date {
  const deadline = new Date(createdAt);

  deadline.setTime(
    deadline.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000,
  );

  return deadline;
}

export function getSlaHours(priority: TicketPriority): number {
  return SLA_HOURS[priority];
}