import {
  TicketCategory,
  TicketPriority,
} from "../generated/prisma/enums";

import {
  AiClassificationResult,
  AiProvider,
} from "./ai.service";

export class FakeAiProvider implements AiProvider {
  constructor(
    private readonly result: AiClassificationResult,
  ) {}

  async classify(): Promise<AiClassificationResult> {
    return this.result;
  }
}