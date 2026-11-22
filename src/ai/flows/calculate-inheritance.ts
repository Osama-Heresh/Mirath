'use server';
/**
 * @fileOverview An Islamic inheritance calculation AI agent.
 *
 * - calculateInheritance - A function that handles the inheritance calculation process.
 * - CalculateInheritanceInput - The input type for the calculateInheritance function.
 * - CalculateInheritanceOutput - The return type for the calculateInheritance function.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CalculateInheritanceInputSchema = z.object({
  familyDetails: z
    .string()
    .describe("The details of the deceased's family relationships in Arabic, including relationships and existing will or testament details."),
  totalEstateValue: z.number().positive().optional().describe('The total value of the estate in Dinars, if known. This is for context only and calculations should not depend on it for share determination.'),
});
export type CalculateInheritanceInput = z.infer<typeof CalculateInheritanceInputSchema>;

const CalculateInheritanceOutputSchema = z.object({
  heirs: z.array(
    z.object({
      name: z.string().describe('The name of the heir in Arabic.'),
      relationship: z.string().describe('The relationship to the deceased in Arabic.'),
      shareText: z.string().describe('The specific textual share of the inheritance for this heir in Arabic (e.g., "النصف", "الربع", "عصبة", "محجوب").'),
      sharePercentage: z.number().min(0).max(100).describe('The percentage of the inheritance for this heir (e.g., for "النصف" return 50, for "الربع" return 25). This must be a numerical value between 0 and 100. If the heir is blocked (محجوب), this should be 0.'),
    })
  ).describe('A list of heirs and their corresponding inheritance share details.'),
  notes: z.string().describe('Any additional legal notes, explanations of complex scenarios (like Radd or Awal), or general considerations in Arabic. This should NOT include the individual shares if they are already in the heirs array.'),
});
export type CalculateInheritanceOutput = z.infer<typeof CalculateInheritanceOutputSchema>;

export type CalculateInheritanceResult =
  | { ok: true; data: CalculateInheritanceOutput }
  | { ok: false; error: string; statusCode?: number };

const MODELS_TO_TRY = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const MAX_ATTEMPTS_PER_MODEL = 2;
const BASE_BACKOFF_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const errObj = error as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof errObj.status === 'number') return errObj.status;
    if (typeof errObj.code === 'number') return errObj.code;
    if (typeof errObj.message === 'string') {
      const match = errObj.message.match(/"code"\s*:\s*(\d{3})/);
      if (match) return Number(match[1]);
    }
  }
  return undefined;
}

function isRetryableError(error: unknown): boolean {
  const status = getErrorStatusCode(error);
  if (status && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(message);
}

function isFallbackEligibleError(error: unknown): boolean {
  const status = getErrorStatusCode(error);
  if (status === 404) return true;
  return isRetryableError(error);
}

function formatArabicUserError(error: unknown): { message: string; statusCode?: number } {
  const statusCode = getErrorStatusCode(error);
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (statusCode === 503 || /UNAVAILABLE|high demand/i.test(rawMessage)) {
    return {
      statusCode: 503,
      message: "الخدمة تشهد ضغطاً مرتفعاً في الطلبات حالياً. يرجى الانتظار بضع ثوانٍ والمحاولة مرة أخرى.",
    };
  }
  if (statusCode === 429 || /RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    return {
      statusCode: 429,
      message: "تم تجاوز حد الطلبات المسموح به حالياً. يرجى المحاولة مرة أخرى بعد قليل.",
    };
  }
  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || /API_KEY_INVALID|PERMISSION_DENIED|Missing Gemini API key/i.test(rawMessage)) {
    return {
      statusCode: statusCode ?? 403,
      message: "تعذر المصادقة مع خدمة الذكاء الاصطناعي. يرجى التحقق من إعدادات مفتاح API في البيئة.",
    };
  }
  return {
    statusCode,
    message: "حدث خطأ أثناء حساب الميراث. الرجاء التأكد من المدخلات والمحاولة مرة أخرى. قد يكون السبب هو تعقيد الحالة المقدمة أو خطأ مؤقت في الخدمة.",
  };
}

function buildInheritancePrompt(input: CalculateInheritanceInput): string {
  const estateContext = input.totalEstateValue
    ? `\nTotal Estate Value (This is for your contextual understanding ONLY. Do NOT use this value to determine shareText or sharePercentage. These must be based purely on Sharia rules): ${input.totalEstateValue} Dinars\n`
    : '';

  return `You are an expert in Islamic inheritance law (Ilm al-Fara'id). Your task is to meticulously calculate the inheritance shares according to Islamic Sharia based on the provided family details and any will/testament.
Output must be in Arabic.

Family Details: ${input.familyDetails}
${estateContext}
For each heir, you MUST populate the 'heirs' array in the output. Each object in the 'heirs' array must contain:
- 'name': The name of the heir in Arabic. If the name is not specified, use a generic term like "الزوجة" or "الابن".
- 'relationship': Their relationship to the deceased in Arabic.
- 'shareText': Their specific textual share of the inheritance (e.g., "النصف", "الربع", "الثلثان", "السدس", "عصبة", "الباقي تعصيباً", "محجوب"). This field must accurately reflect the individual's entitlement or status based on Sharia.
- 'sharePercentage': This field **MUST be the direct numerical translation** of the 'shareText' and represent the heir's percentage of the total estate. This value must be a number between 0 and 100, precise to two decimal places where appropriate (e.g., 16.67, 33.33).
    - If 'shareText' is "النصف", 'sharePercentage' MUST be 50.
    - If 'shareText' is "الربع", 'sharePercentage' MUST be 25.
    - If 'shareText' is "الثمن", 'sharePercentage' MUST be 12.5.
    - If 'shareText' is "السدس", 'sharePercentage' MUST be 16.67.
    - If 'shareText' is "الثلث", 'sharePercentage' MUST be 33.33.
    - If 'shareText' is "الثلثان", 'sharePercentage' MUST be 66.67.
    - If 'shareText' is "محجوب" (blocked), 'sharePercentage' MUST be 0.
    - If 'shareText' is "عصبة" (Residuary) or "الباقي تعصيباً" or similar indicating a residuary heir:
        1. First, identify all heirs entitled to fixed shares (Furoodh Al-Muqaddarah) and calculate their respective 'sharePercentage' values based on the rules above (e.g., 1/2 = 50, 1/4 = 25).
        2. Sum these fixed percentages for all Furoodh heirs.
        3. Calculate the total remaining percentage of the estate: \`R = 100 - (sum of fixed percentages)\`. This \`R\` is the portion to be distributed among the 'Asaba'.
        4. This remaining percentage \`R\` is then distributed among all 'Asaba' heirs.
           - When sons and daughters inherit together as 'Asaba', the rule 'لِلذَّكَرِ مِثْلُ حَظِّ الْأُنْثَيَيْنِ' (the male receives twice the share of the female) applies to this remainder \`R\`.
           - To calculate this:
             a. Determine the total number of 'parts' for the 'Asaba' group. Each son counts as 2 parts, and each daughter counts as 1 part. (e.g., 1 son and 1 daughter = 2+1 = 3 parts; 2 sons and 3 daughters = (2*2) + (3*1) = 4 + 3 = 7 parts). Let this be \`TotalParts\`.
             b. The 'sharePercentage' for each son is their individual share of the *total estate*, calculated as: \`(2 / TotalParts) * R\`.
             c. The 'sharePercentage' for each daughter is their individual share of the *total estate*, calculated as: \`(1 / TotalParts) * R\`.
           - Similar principles apply to other 'Asaba' combinations based on their specific Sharia rules. You MUST correctly apply these ratios for all 'Asaba'.
        5. The 'sharePercentage' for each 'Asaba' heir MUST be their calculated share *of the total estate* (i.e., the value calculated in step 4b or 4c). These are percentages of the 100% total estate, not percentages of the remainder \`R\` itself.
           - Example 1: If the remainder \`R\` is 30% of the total estate, and there is one son and one daughter (\`TotalParts\` = 3):
             - Son's 'sharePercentage' = (2 / 3) * 30 = 20 (representing 20% of the total estate).
             - Daughter's 'sharePercentage' = (1 / 3) * 30 = 10 (representing 10% of the total estate).
           - Example 2: If the remainder \`R\` is 70% and there are 2 sons and 3 daughters (\`TotalParts\` = 7):
             - Each son's 'sharePercentage' = (2 / 7) * 70 = 20 (representing 20% of the total estate for each son).
             - Each daughter's 'sharePercentage' = (1 / 7) * 70 = 10 (representing 10% of the total estate for each daughter).
        These 'sharePercentage' values MUST be accurately calculated and precise to two decimal places where appropriate.

It is CRITICAL that 'sharePercentage' is accurately derived and reflects the correct Islamic law application for all heirs.

The sum of all 'sharePercentage' values for all unblocked heirs MUST equal 100, unless 'العول' (Awal - increase in denominator, decrease in shares) or 'الرد' (Radd - return of surplus to certain heirs) applies.
- If 'Awal' or 'Radd' is necessary, you MUST clearly explain the situation and the method of adjustment in the 'notes' field.
- If 'Awal' applies, the individual 'sharePercentage' values should be adjusted downwards so their sum still equals 100. State the original shares and the adjusted shares in the notes.
- If 'Radd' applies, the individual 'sharePercentage' values of eligible heirs should be adjusted upwards so their sum equals 100. State the original shares and the adjusted shares in the notes.

Use the 'notes' field ONLY for additional legal considerations, explanations of complex scenarios like 'Radd' or 'Awal', details from a will that affect distribution after fixed shares, or general observations.
Do NOT repeat the individual share percentages in the 'notes' field if they are already correctly listed for each heir in the 'heirs' array.
The 'notes' field provides context or explanations that apply to the overall distribution or specific legal points not covered by the individual share descriptions.
Provide very precise percentages for sharePercentage (e.g., 16.67 for 1/6, 33.33 for 1/3).
Double-check all calculations to ensure accuracy and adherence to Sharia principles.
`;
}

export async function calculateInheritance(input: CalculateInheritanceInput): Promise<CalculateInheritanceResult> {
  try {
    const data = await calculateInheritanceFlow(input);
    return { ok: true, data };
  } catch (error) {
    console.error('Error in calculateInheritance server action:', error);
    const { message, statusCode } = formatArabicUserError(error);
    return { ok: false, error: message, statusCode };
  }
}

const calculateInheritanceFlow = ai.defineFlow(
  {
    name: 'calculateInheritanceFlow',
    inputSchema: CalculateInheritanceInputSchema,
    outputSchema: CalculateInheritanceOutputSchema,
  },
  async input => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      const missingKeyError = new Error(
        'Missing Gemini API key: neither GEMINI_API_KEY nor GOOGLE_GENAI_API_KEY is set.'
      );
      console.error('calculateInheritanceFlow configuration error:', missingKeyError);
      throw missingKeyError;
    }

    const genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = buildInheritancePrompt(input);
    let lastError: unknown;

    for (const modelName of MODELS_TO_TRY) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
        try {
          const response = await genAI.models.generateContent({
            model: modelName,
            contents: promptText,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  heirs: {
                    type: Type.ARRAY,
                    description: 'A list of heirs and their corresponding inheritance share details.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: {
                          type: Type.STRING,
                          description: 'The name of the heir in Arabic.',
                        },
                        relationship: {
                          type: Type.STRING,
                          description: 'The relationship to the deceased in Arabic.',
                        },
                        shareText: {
                          type: Type.STRING,
                          description: 'The specific textual share of the inheritance for this heir in Arabic (e.g., "النصف", "الربع", "عصبة", "محجوب").',
                        },
                        sharePercentage: {
                          type: Type.NUMBER,
                          description: 'The percentage of the inheritance for this heir between 0 and 100. If blocked (محجوب), 0.',
                        },
                      },
                      required: ['name', 'relationship', 'shareText', 'sharePercentage'],
                    },
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Any additional legal notes or explanations in Arabic.',
                  },
                },
                required: ['heirs', 'notes'],
              },
            },
          });

          const rawText = response.text?.trim();
          if (!rawText) {
            const emptyOutputError = new Error(
              `calculateInheritanceFlow: Model "${modelName}" returned empty or null output.`
            );
            console.error(emptyOutputError.message, { input, modelName, attempt });
            throw emptyOutputError;
          }

          const parsedJson = JSON.parse(rawText);
          return CalculateInheritanceOutputSchema.parse(parsedJson);
        } catch (error) {
          lastError = error;
          console.error(
            `Error in calculateInheritanceFlow (model=${modelName}, attempt=${attempt + 1}/${MAX_ATTEMPTS_PER_MODEL}):`,
            error
          );

          if (!isFallbackEligibleError(error)) {
            throw error;
          }

          if (isRetryableError(error) && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
            await sleep(delayMs);
            continue;
          }

          break;
        }
      }
    }

    console.error('Error in calculateInheritanceFlow: All models and retry attempts exhausted.', lastError);
    throw lastError;
  }
);
