"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const CATEGORIES = [
  "travel",
  "meals",
  "lodging",
  "software",
  "supplies",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_RETURNED_LINES = 20;

const PROMPT = [
  "You are extracting line items from a receipt image (or PDF).",
  "",
  'Return ONLY a JSON array of objects with this exact shape:',
  '  { "description": string, "category": "travel"|"meals"|"lodging"|"software"|"supplies"|"other", "quantity": number, "unitAmount": number }',
  "",
  "`unitAmount` is per-unit in the receipt's currency (a number, no symbol). If a line shows a total only, infer quantity 1.",
  'Tax, tip, service charge, and gratuity each become their own line with category "other" (or "meals" for tip on a meal).',
  "Skip subtotals and grand totals — those are derived from the lines.",
  "If the receipt is unreadable or has no line items, return [].",
  "Do not include any text outside the JSON array.",
].join("\n");

interface ExtractedLine {
  description: string;
  category: Category;
  quantity: number;
  unitAmount: number;
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Defensive validator. Drops malformed items rather than throwing —
 * partial extraction is better than none.
 */
function sanitizeLines(raw: unknown): ExtractedLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractedLine[] = [];
  for (const item of raw) {
    if (out.length >= MAX_RETURNED_LINES) break;
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const description = obj.description;
    const category = obj.category;
    const quantity = obj.quantity;
    const unitAmount = obj.unitAmount;
    if (typeof description !== "string" || description.trim() === "") continue;
    if (!isCategory(category)) continue;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (typeof unitAmount !== "number" || !Number.isFinite(unitAmount) || unitAmount <= 0) continue;
    out.push({
      description: description.trim().slice(0, 200),
      category,
      quantity,
      unitAmount,
    });
  }
  return out;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return buf.toString("base64");
}

export const extractLinesFromReceipt = action({
  args: { storageId: v.id("_storage") },
  handler: async (
    ctx,
    { storageId },
  ): Promise<{ lines: ExtractedLine[] }> => {
    // 1. Auth: caller must own a draft expense whose receiptStorageId === storageId.
    //    We delegate the ownership lookup to a query (actions can't read DB directly).
    const ok: boolean = await ctx.runQuery(api.expenses.callerOwnsDraftWithReceipt, {
      storageId: storageId as Id<"_storage">,
    });
    if (!ok) {
      throw new ConvexError(
        "You can only auto-fill receipts on your own draft or rejected expenses.",
      );
    }

    // 2. API key check.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ConvexError(
        "Gemini API key not configured. Ask an admin to set GEMINI_API_KEY.",
      );
    }

    // 3. Fetch the receipt blob from Convex storage.
    const blob = await ctx.storage.get(storageId);
    if (!blob) {
      throw new ConvexError("Receipt file not found in storage.");
    }
    const mimeType = blob.type || "image/jpeg";
    if (
      !mimeType.startsWith("image/") &&
      mimeType !== "application/pdf"
    ) {
      throw new ConvexError(
        `Unsupported receipt type: ${mimeType}. Use an image or PDF.`,
      );
    }
    const base64 = await blobToBase64(blob);

    // 4. Call Gemini with multimodal input + strict JSON schema.
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              description: { type: "STRING" },
              category: {
                type: "STRING",
                enum: [...CATEGORIES],
              },
              quantity: { type: "NUMBER" },
              unitAmount: { type: "NUMBER" },
            },
            required: ["description", "category", "quantity", "unitAmount"],
            propertyOrdering: [
              "description",
              "category",
              "quantity",
              "unitAmount",
            ],
          },
        },
        temperature: 0.1,
      },
    };

    let res: Response;
    try {
      res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("Gemini fetch failed:", err);
      throw new ConvexError("Could not reach the receipt OCR service.");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Gemini ${res.status}:`, text.slice(0, 500));
      throw new ConvexError(
        `Receipt OCR failed (${res.status}). Enter line items manually.`,
      );
    }

    const payload = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };

    const blockReason = payload.promptFeedback?.blockReason;
    if (blockReason) {
      throw new ConvexError(
        `Receipt OCR was blocked by safety filters (${blockReason}).`,
      );
    }

    const textPart = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof textPart !== "string" || textPart.trim() === "") {
      return { lines: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textPart);
    } catch (err) {
      console.error("Gemini returned non-JSON:", textPart.slice(0, 500), err);
      return { lines: [] };
    }

    return { lines: sanitizeLines(parsed) };
  },
});
