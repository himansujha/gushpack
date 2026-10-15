import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseWhatsApp } from "./whatsapp";

export type Classification = "Hot" | "Warm" | "Cold";
export type AnalysisRow = {
  lead_id: string;
  status: "pending" | "done" | "failed";
  source: "ai" | "sample" | "fallback" | null;
  classification: Classification | null;
  reason: string | null;
  next_follow_up_date: string | null;
  do_not_contact: boolean;
  urgent: boolean;
  action_prompt: string | null;
  suggested_message: string | null;
  draft_message: string | null;
  draft_edited: boolean;
  follow_up_status: "pending" | "sent";
  error: string | null;
  analyzed_at: string | null;
};
export type LeadSummary = {
  id: string;
  name: string;
  company: string;
  phone: string;
  source: string;
  last_contact_date: string;
  rep_id: string;
  rep_name: string;
  analysis: AnalysisRow | null;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
const normalizePhone = (p: string) => p.replace(/\D/g, "");

function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

async function runAnalysis(leadId: string, today: string) {
  const { analyzeWithAI, analyzeFallback, AnalysisError } = await import("./analysis.server");
  const sb = await db();
  const lead = must(await sb.from("leads").select("*, reps(name)").eq("id", leadId).single());
  const msgs = must(
    await sb.from("messages").select("sender, body, sent_at").eq("lead_id", leadId).order("sent_at"),
  );
  const prevRes = await sb.from("analyses").select("*").eq("lead_id", leadId).maybeSingle();
  if (prevRes.error) throw new Error(prevRes.error.message);
  const prev = prevRes.data;
  const input = {
    today,
    lead: { name: lead.name, company: lead.company, source: lead.source, last_contact_date: lead.last_contact_date },
    repName: (lead.reps as { name: string } | null)?.name ?? "Sales rep",
    messages: msgs as { sender: "buyer" | "rep"; body: string; sent_at: string }[],
  };

  let result;
  let source: "ai" | "fallback" = "ai";
  try {
    result = await analyzeWithAI(input);
  } catch (e) {
    if (e instanceof AnalysisError && e.message === "NO_KEY") {
      result = analyzeFallback(input);
      source = "fallback";
    } else {
      const message = e instanceof Error ? e.message : "AI analysis failed.";
      must(
        await sb
          .from("analyses")
          .upsert({ lead_id: leadId, status: "failed", error: message, updated_at: new Date().toISOString() }),
      );
      return { ok: false as const, error: message };
    }
  }

  const keepDraft = prev?.draft_edited && prev.draft_message;
  must(
    await sb.from("analyses").upsert({
      lead_id: leadId,
      status: "done",
      source,
      classification: result.classification,
      reason: result.reason,
      next_follow_up_date: result.next_follow_up_date,
      do_not_contact: result.do_not_contact,
      urgent: result.urgent,
      suggested_message: result.message,
      draft_message: keepDraft ? prev!.draft_message : result.message,
      draft_edited: !!keepDraft,
      follow_up_status: "pending",
      error: null,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  );
  return { ok: true as const };
}

export const listLeads = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const rows = must(
    await sb.from("leads").select("id, name, company, phone, source, last_contact_date, rep_id, reps(name), analyses(*)").order("name"),
  );
  return rows.map((r) => {
    const a = r.analyses as unknown;
    return {
      id: r.id,
      name: r.name,
      company: r.company,
      phone: r.phone,
      source: r.source,
      last_contact_date: r.last_contact_date,
      rep_id: r.rep_id,
      rep_name: (r.reps as { name: string } | null)?.name ?? "",
      analysis: (Array.isArray(a) ? a[0] ?? null : a ?? null) as AnalysisRow | null,
    } satisfies LeadSummary;
  });
});

export const listReps = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  return must(await sb.from("reps").select("id, name").order("name"));
});

export const getLead = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const leadRes = await sb.from("leads").select("*, reps(name)").eq("id", data.id).maybeSingle();
    if (leadRes.error) throw new Error(leadRes.error.message);
    const lead = leadRes.data;
    if (!lead) return null;
    const [messages, analysis, activities] = await Promise.all([
      sb.from("messages").select("id, sender, body, sent_at").eq("lead_id", data.id).order("sent_at"),
      sb.from("analyses").select("*").eq("lead_id", data.id).maybeSingle(),
      sb.from("activities").select("id, type, details, created_at").eq("lead_id", data.id).order("created_at", { ascending: false }),
    ]);
    return {
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        source: lead.source,
        last_contact_date: lead.last_contact_date,
        rep_id: lead.rep_id,
        rep_name: (lead.reps as { name: string } | null)?.name ?? "",
      },
      messages: must(messages) as { id: string; sender: "buyer" | "rep"; body: string; sent_at: string }[],
      analysis: (analysis.data ?? null) as AnalysisRow | null,
      activities: must(activities),
    };
  });

export const findByPhone = createServerFn({ method: "GET" })
  .validator((d: { phone: string }) => z.object({ phone: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const r = await sb.from("leads").select("id, name, company").eq("phone_normalized", normalizePhone(data.phone)).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });

const newLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(25).refine((p) => normalizePhone(p).length >= 7, "Invalid phone"),
  source: z.string().trim().min(2).max(60),
  last_contact_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rep_id: z.string().uuid(),
  conversation: z.string().max(20000).optional().default(""),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createLead = createServerFn({ method: "POST" })
  .validator((d: z.input<typeof newLeadSchema>) => newLeadSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const phoneNorm = normalizePhone(data.phone);
    const dup = (await sb.from("leads").select("id, name, company").eq("phone_normalized", phoneNorm).maybeSingle()).data;
    if (dup) return { duplicate: dup };

    const rep = must(await sb.from("reps").select("name").eq("id", data.rep_id).single());
    const parsed = data.conversation.trim() ? parseWhatsApp(data.conversation, rep.name, data.last_contact_date) : [];
    const latest = parsed.reduce((max, m) => (m.sent_at.slice(0, 10) > max ? m.sent_at.slice(0, 10) : max), data.last_contact_date);

    const lead = must(
      await sb
        .from("leads")
        .insert({
          name: data.name,
          company: data.company,
          phone: data.phone,
          phone_normalized: phoneNorm,
          source: data.source,
          last_contact_date: latest,
          rep_id: data.rep_id,
        })
        .select("id")
        .single(),
    );
    if (parsed.length) must(await sb.from("messages").insert(parsed.map((m) => ({ ...m, lead_id: lead.id }))));
    must(await sb.from("analyses").insert({ lead_id: lead.id, status: "pending" }));
    must(await sb.from("activities").insert({ lead_id: lead.id, type: "created", details: parsed.length ? `Lead created with ${parsed.length} messages` : "Lead created" }));
    const analysis = await runAnalysis(lead.id, data.today);
    return { id: lead.id, messages: parsed.length, analysis };
  });

export const addConversation = createServerFn({ method: "POST" })
  .validator((d: { leadId: string; text: string; contactDate: string; today: string }) =>
    z
      .object({
        leadId: z.string().uuid(),
        text: z.string().trim().min(1).max(20000),
        contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    const lead = must(await sb.from("leads").select("last_contact_date, reps(name)").eq("id", data.leadId).single());
    const parsed = parseWhatsApp(data.text, (lead.reps as { name: string } | null)?.name ?? "", data.contactDate);
    if (!parsed.length) throw new Error("No messages found in the pasted text.");
    must(await sb.from("messages").insert(parsed.map((m) => ({ ...m, lead_id: data.leadId }))));
    const latest = parsed.reduce((max, m) => (m.sent_at.slice(0, 10) > max ? m.sent_at.slice(0, 10) : max), data.contactDate);
    if (latest > lead.last_contact_date) must(await sb.from("leads").update({ last_contact_date: latest }).eq("id", data.leadId));
    must(await sb.from("activities").insert({ lead_id: data.leadId, type: "conversation", details: `Added ${parsed.length} messages` }));
    must(await sb.from("analyses").upsert({ lead_id: data.leadId, status: "pending" }));
    const analysis = await runAnalysis(data.leadId, data.today);
    return { messages: parsed.length, analysis };
  });

export const reanalyze = createServerFn({ method: "POST" })
  .validator((d: { leadId: string; today: string }) =>
    z.object({ leadId: z.string().uuid(), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }) => runAnalysis(data.leadId, data.today));

export const saveDraft = createServerFn({ method: "POST" })
  .validator((d: { leadId: string; draft: string }) =>
    z.object({ leadId: z.string().uuid(), draft: z.string().trim().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    must(
      await sb
        .from("analyses")
        .update({ draft_message: data.draft, draft_edited: true, updated_at: new Date().toISOString() })
        .eq("lead_id", data.leadId),
    );
    must(await sb.from("activities").insert({ lead_id: data.leadId, type: "draft_edited", details: "Draft message edited" }));
    return { ok: true };
  });

const INTERVAL: Record<Classification, number> = { Hot: 2, Warm: 4, Cold: 10 };

export const markSent = createServerFn({ method: "POST" })
  .validator((d: { leadId: string; message: string; today: string }) =>
    z
      .object({
        leadId: z.string().uuid(),
        message: z.string().trim().min(1).max(2000),
        today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { addDays } = await import("./analysis.server");
    const sb = await db();
    const a = must(await sb.from("analyses").select("classification, do_not_contact").eq("lead_id", data.leadId).single());
    const next = a.do_not_contact ? null : addDays(data.today, INTERVAL[(a.classification as Classification) ?? "Warm"] ?? 4);
    must(await sb.from("messages").insert({ lead_id: data.leadId, sender: "rep", body: data.message, sent_at: new Date().toISOString() }));
    must(await sb.from("leads").update({ last_contact_date: data.today }).eq("id", data.leadId));
    must(
      await sb
        .from("analyses")
        .update({
          follow_up_status: "sent",
          next_follow_up_date: next,
          urgent: false,
          draft_message: data.message,
          draft_edited: false,
          updated_at: new Date().toISOString(),
        })
        .eq("lead_id", data.leadId),
    );
    must(await sb.from("activities").insert({ lead_id: data.leadId, type: "sent", details: data.message }));
    return { next };
  });

export const askGippi = createServerFn({ method: "POST" })
  .validator((d: { queryText: string; today: string }) =>
    z
      .object({
        queryText: z.string().trim().min(1).max(1000),
        today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { askGippiWithAI } = await import("./analysis.server");
    const sb = await db();

    const [leadsRes, msgsRes, repsRes] = await Promise.all([
      sb
        .from("leads")
        .select(`
          id, name, company, phone, source, last_contact_date,
          reps(name),
          analyses(classification, reason, next_follow_up_date, urgent, do_not_contact, action_prompt, draft_message, follow_up_status)
        `)
        .order("name"),
      sb
        .from("messages")
        .select("lead_id, sender, body, sent_at")
        .order("sent_at", { ascending: true }),
      sb.from("reps").select("id, name"),
    ]);

    const messages = msgsRes.data ?? [];
    const repsList = (repsRes.data ?? []).map((r) => r.name);

    const leads = (leadsRes.data ?? []).map((l: any) => {
      const a = Array.isArray(l.analyses) ? l.analyses[0] : l.analyses;
      const leadMsgs = messages.filter((m) => m.lead_id === l.id);
      return {
        name: l.name,
        company: l.company,
        phone: l.phone,
        repName: (l.reps as { name: string } | null)?.name ?? "Sales rep",
        source: l.source,
        lastContactDate: l.last_contact_date,
        classification: a?.classification ?? "Unclassified",
        reason: a?.reason ?? "",
        next_follow_up_date: a?.next_follow_up_date ?? null,
        urgent: a?.urgent ?? false,
        do_not_contact: a?.do_not_contact ?? false,
        actionPrompt: a?.action_prompt,
        draftMessage: a?.draft_message,
        recentConversation: leadMsgs.slice(-2).map((m) => `${m.sender === "buyer" ? l.name : "Rep"}: "${m.body}"`).join(" | ") || null,
      };
    });

    return askGippiWithAI({
      queryText: data.queryText,
      leadsSummary: leads,
      repsList,
      today: data.today,
    });
  });

export { todayUTC };

