import {
  AiClassificationResult,
  AiProvider,
} from "./ai.service";

export interface AiRunResult {
  classification?: AiClassificationResult;
  failed: boolean;
  failureReason?: string;
}

export async function runAiWithTimeout(
  provider: AiProvider,
  input: {
    customerPlan: string;
    subject: string;
    body: string;
  },
  timeoutMs: number,
): Promise<AiRunResult> {
  try {
    const classification = await Promise.race([
      provider.classify(input),

      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("AI request timed out"));
        }, timeoutMs);
      }),
    ]);

    return {
      classification,
      failed: false,
    };
  } catch (error) {
    return {
      failed: true,
      failureReason:
        error instanceof Error ? error.message : "Unknown AI failure",
    };
  }
}