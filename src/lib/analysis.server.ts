import fs from "node:fs";
import path from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { z } from "zod";

function loadEnvFallback() {
  if (process.env["GEMINI_API_KEY"]) return;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

const OPENAI_GATEWAY_URL = process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env["OPENAI_MODEL"] || "gpt-4o-mini";
const GEMINI_PRIMARY_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";

function getModelCandidates() {
  loadEnvFallback();
  const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return [
      { model: google(GEMINI_PRIMARY_MODEL), name: GEMINI_PRIMARY_MODEL },
      { model: google("gemini-3.6-flash"), name: "gemini-3.6-flash" },
      { model: google("gemini-3.5-flash"), name: "gemini-3.5-flash" },
    ];
  }

  const openAiKey = process.env["OPENAI_API_KEY"];
  if (openAiKey) {
    const openai = createOpenAI({ baseURL: OPENAI_GATEWAY_URL, apiKey: openAiKey });
    return [{ model: openai(OPENAI_MODEL), name: "OpenAI (" + OPENAI_MODEL + ")" }];
  }

  return [];
}

export type AnalysisInput = {
  today: string; // YYYY-MM-DD
  lead: { name: string; company: string; source: string; last_contact_date: string };
  repName: string;
  messages: { sender: "buyer" | "rep"; body: string; sent_at: string }[];
};

export const analysisSchema = z.object({
  classification: z.enum(["Hot", "Warm", "Cold"]),
  reason: z.string().min(5),
  next_follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  do_not_contact: z.boolean(),
  urgent: z.boolean(),
  action_prompt: z.string().optional(),
  message: z.string().min(5),
});
export type AnalysisResult = z.infer<typeof analysisSchema>;

export class AnalysisError extends Error {}

function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const INSTRUCTIONS = `You are a sales follow-up assistant for a small B2B company that sells packaging equipment (filling, sealing, wrapping, capping, vacuum and bagging machines).
Given one lead and its WhatsApp conversation history, return ONLY a JSON object with these keys:
- "classification": "Hot" (strong purchase intent or needs urgent response), "Warm" (interested, not committed), or "Cold" (little current interest or stopped responding).
- "reason": ONE concise sentence explaining the classification, grounded in the lead info and conversation.
- "next_follow_up_date": YYYY-MM-DD date for the next follow-up, never before today. Respect explicit callback dates the buyer gave (e.g. "call me Monday", "in 2 weeks"), computed from the date that message was sent. Defaults when no date was given: Hot = today (or tomorrow if the rep already replied today), Warm = 3 days after the last contact, Cold = 7-10 days after the last contact. If the date that results is already in the past, use today. Use null ONLY when the buyer asked not to be contacted.
- "do_not_contact": true only if the buyer asked not to be contacted.
- "urgent": true if the buyer made an urgent or time-bound request that is waiting on us.
- "action_prompt": ONE concise, natural sentence (4-10 words) instructing the sales rep on what this message accomplishes (e.g. "Please send this follow-up message to confirm delivery", "Send this quick check-in to keep momentum", "Please reply with these quotation details", "Reach out with this friendly nudge", etc.). Do NOT repeat the exact same static phrase for every lead; make it tailored and agentic.
- "message": a short, natural, professional WhatsApp message (1-3 sentences) the rep should send next, addressed to the buyer by name, referring to the actual conversation and the next step. NEVER invent prices, discounts, delivery dates, stock availability or other commitments. If there is no conversation, write a short introductory message based only on the lead info and do not pretend a previous conversation happened. If do_not_contact is true, the message should be: "No follow-up recommended: the buyer asked not to be contacted."`;

function buildPrompt(input: AnalysisInput) {
  const convo = input.messages.length
    ? input.messages
        .map((m) => `[${m.sent_at.slice(0, 16).replace("T", " ")}] ${m.sender === "rep" ? `Rep (${input.repName})` : `Buyer (${input.lead.name})`}: ${m.body}`)
        .join("\n")
    : "(No conversation available.)";
  return `Today is ${input.today}.
Lead:
- Name: ${input.lead.name}
- Company: ${input.lead.company}
- Source: ${input.lead.source}
- Last contact date: ${input.lead.last_contact_date}
- Assigned sales rep: ${input.repName}

Conversation history (oldest first):
${convo}

Return the JSON object now.`;
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AnalysisError("AI response did not contain JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(result: AnalysisResult, today: string): AnalysisResult {
  const r = {
    ...result,
    reason: result.reason.trim(),
    message: result.message.trim(),
    action_prompt: result.action_prompt?.trim() || undefined,
  };
  if (r.do_not_contact) r.next_follow_up_date = null;
  else if (!r.next_follow_up_date || r.next_follow_up_date < today) r.next_follow_up_date = today;
  return r;
}

export async function analyzeWithAI(input: AnalysisInput): Promise<AnalysisResult> {
  const candidates = getModelCandidates();
  if (candidates.length === 0) throw new AnalysisError("NO_KEY");

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const result = streamText({
        model: candidate.model,
        instructions: INSTRUCTIONS,
        prompt: buildPrompt(input),
        maxRetries: 1,
      });
      const text = await result.text;
      const parsed = extractJson(text);
      const check = analysisSchema.safeParse(parsed);
      if (check.success) {
        return normalize(check.data, input.today);
      }
    } catch (e) {
      lastError = e;
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 401) throw new AnalysisError("Invalid API key for " + candidate.name + ".");
      // If 503 or 429 quota, continue to next candidate model
      continue;
    }
  }

  const status = (lastError as { statusCode?: number } | null)?.statusCode;
  if (status === 429) throw new AnalysisError("AI rate limit reached. Please retry in a moment.");
  throw new AnalysisError(`AI analysis failed${status ? ` (${status})` : ""}. Please retry.`);
}

export async function askGippiWithAI({
  queryText,
  leadsSummary,
  repsList,
  today,
}: {
  queryText: string;
  leadsSummary: Array<{
    name: string;
    company: string;
    phone?: string | null;
    repName: string;
    source?: string | null;
    lastContactDate?: string | null;
    classification?: string | null;
    reason?: string | null;
    next_follow_up_date?: string | null;
    urgent?: boolean;
    do_not_contact?: boolean;
    actionPrompt?: string | null;
    draftMessage?: string | null;
    recentConversation?: string | null;
  }>;
  repsList?: string[];
  today: string;
}): Promise<string> {
  const candidates = getModelCandidates();
  if (candidates.length === 0) throw new Error("NO_KEY");

  const system = `You are Gippi, the dedicated, friendly, and intelligent AI sales assistant for gushpack (B2B packaging machinery).
You have real-time access to the entire company database of leads, WhatsApp conversations, reps, and pipeline statuses.

GUIDELINES:
1. GREETINGS & CASUAL CONVERSATION:
   - When the user says "hi", "hey", "hello", "good morning", "who are you", etc.:
     Greet them warmly and introduce yourself naturally, for example:
     "Hey! I am Gippi, your AI sales assistant. I have full context on all 23 leads across your pipeline. How can I help you today? You can ask me about hot deals, overdue follow-ups, specific reps, or message suggestions!"
2. DEEP DATABASE GROUNDING:
   - When answering questions about leads, buyers, reps, machines/equipment (e.g. VFFS, pouch fillers, nitrogen flushing, vacuum packers, cappers), POs, or follow-ups, use the live database context accurately.
3. CONVERSATIONAL & HUMAN-LIKE:
   - Speak naturally like a knowledgeable, proactive sales colleague.
   - Keep answers concise and readable (typically 2 to 3 sentences).
   - If asked for a list or breakdown, use clean bullet points.
   - Never output dry, robotic templates like "Gippi analyzed ...".`;

  const prompt = `Today's Date: ${today}
Sales Reps: ${(repsList || []).join(", ") || "Snehil Singh, Himansu Jha, Snehith Galla, Nayrhit Bhattacharya, Adithya Venkatesh"}

COMPLETE DATABASE CONTEXT (${leadsSummary.length} total leads):
${JSON.stringify(leadsSummary, null, 2)}

User Question: "${queryText}"`;

  for (const candidate of candidates) {
    try {
      const { text } = await generateText({
        model: candidate.model,
        system,
        prompt,
        maxRetries: 1,
      });
      if (text && text.trim()) {
        return text.trim();
      }
    } catch {
      // Continue to next candidate model
      continue;
    }
  }

  throw new Error("Unable to generate response from available AI models.");
}

/** Rule-based fallback used only when AI credentials are unavailable. */
export function analyzeFallback(input: AnalysisInput): AnalysisResult {
  const { today, lead, messages } = input;
  const buyerText = messages.filter((m) => m.sender === "buyer").map((m) => m.body.toLowerCase()).join(" ");
  const last = messages[messages.length - 1];
  const first = lead.name.split(" ")[0];
  if (/don'?t contact|do not contact|not interested|stop messag/.test(buyerText)) {
    return {
      classification: "Cold",
      reason: "Buyer asked not to be contacted.",
      next_follow_up_date: null,
      do_not_contact: true,
      urgent: false,
      action_prompt: "No follow-up needed as requested",
      message: "No follow-up recommended: the buyer asked not to be contacted.",
    };
  }
  if (/urgent|this week|asap|\bpo\b|immediately|quickly|waiting/.test(buyerText)) {
    return {
      classification: "Hot",
      reason: "Buyer made an urgent or time-bound request in the conversation.",
      next_follow_up_date: today,
      do_not_contact: false,
      urgent: true,
      action_prompt: "Please send this urgent follow-up message",
      message: `Hi ${first}, following up on your request. Could we connect today to take this forward?`,
    };
  }
  if (!messages.length) {
    return {
      classification: "Warm",
      reason: "New lead with no conversation yet; needs a first contact.",
      next_follow_up_date: today,
      do_not_contact: false,
      urgent: false,
      action_prompt: "Send this introductory message to initiate contact",
      message: `Hi ${first}, thanks for your interest in our packaging machines. What products are you looking to pack so I can suggest suitable options?`,
    };
  }
  if (last?.sender === "rep") {
    const d = addDays(lead.last_contact_date, 7);
    return {
      classification: "Cold",
      reason: "Buyer has not replied to the latest message.",
      next_follow_up_date: d < today ? today : d,
      do_not_contact: false,
      urgent: false,
      action_prompt: "Consider checking in with this gentle nudge",
      message: `Hi ${first}, just checking in on my last message. Let me know if you have any questions.`,
    };
  }
  const d = addDays(lead.last_contact_date, 3);
  return {
    classification: "Warm",
    reason: "Buyer is engaged in the conversation but has not committed.",
    next_follow_up_date: d < today ? today : d,
    do_not_contact: false,
    urgent: false,
    action_prompt: "Please send this follow-up message to keep momentum",
    message: `Hi ${first}, thanks for your message. Is there anything else I can share to help with your decision?`,
  };
}

export { addDays };
