import { z } from "zod";

export const createTicketSchema = z.object({
  external_id: z.string().min(1),
  customer_id: z.string().min(1),
  customer_plan: z.enum(["free", "pro", "enterprise"]),
  subject: z.string(),
  body: z.string(),
  created_at: z.coerce.date(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;