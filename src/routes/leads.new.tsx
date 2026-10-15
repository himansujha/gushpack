import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  Building2,
  User,
  Phone,
  Calendar,
  Tag,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ConversationBuilder } from "@/components/ConversationBuilder";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLead, findByPhone } from "@/lib/leads.functions";
import { localToday, repsQuery } from "@/lib/lead-queries";

const SOURCES = [
  "Trade show",
  "Website enquiry",
  "Referral",
  "IndiaMART",
  "Cold call",
  "Facebook ad",
  "WhatsApp",
  "Other",
];

type Form = {
  name: string;
  company: string;
  phone: string;
  source: string;
  last_contact_date: string;
  rep_id: string;
  conversation: string;
};

const empty = (): Form => ({
  name: "",
  company: "",
  phone: "",
  source: "",
  last_contact_date: localToday(),
  rep_id: "",
  conversation: "",
});

export const Route = createFileRoute("/leads/new")({
  head: () => ({
    meta: [
      { title: "New Lead — gushpack" },
      {
        name: "description",
        content: "Add a new lead and automatically classify and schedule follow-ups with AI.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(repsQuery),
  component: NewLeadPage,
});

function NewLeadPage() {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [duplicate, setDuplicate] = useState<{ id: string; name: string; company: string } | null>(null);

  const reps = useQuery(repsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    if (k === "phone") setDuplicate(null);
  };

  const checkPhone = async () => {
    if (form.phone.replace(/\D/g, "").length < 7) return;
    try {
      setDuplicate((await findByPhone({ data: { phone: form.phone } })) ?? null);
    } catch {
      /* non-blocking */
    }
  };

  const mutation = useMutation({
    mutationFn: () => createLead({ data: { ...form, today: localToday() } }),
    onSuccess: async (res) => {
      if ("duplicate" in res && res.duplicate) {
        setDuplicate(res.duplicate);
        return;
      }
      if (!("id" in res)) return;
      await qc.invalidateQueries({ queryKey: ["leads"] });
      if (res.analysis.ok) {
        toast.success("Lead created and analysed successfully");
      } else {
        toast.error(`Lead created, but analysis failed: ${res.analysis.error}`, {
          description: "You can retry analysis from the lead details page.",
        });
      }
      navigate({ to: "/leads/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create the lead"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (form.name.trim().length < 2) errs.name = "Enter the buyer's name";
    if (form.company.trim().length < 2) errs.company = "Enter the company name";
    if (form.phone.replace(/\D/g, "").length < 7) errs.phone = "Enter a valid phone number";
    if (!form.source) errs.source = "Choose a lead source";
    if (!form.last_contact_date) errs.last_contact_date = "Choose a contact date";
    else if (form.last_contact_date > localToday()) errs.last_contact_date = "Date cannot be in the future";
    if (!form.rep_id) errs.rep_id = "Assign to a sales rep";
    setErrors(errs);
    if (Object.keys(errs).length || duplicate) return;
    mutation.mutate();
  };

  const err = (k: keyof Form) =>
    errors[k] && <p className="text-xs text-destructive mt-1 font-medium">{errors[k]}</p>;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-foreground">Add New Lead</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter buyer details to generate AI-driven classification, schedule, and follow-up copy.
        </p>
      </div>

      {/* Main Workspace Form */}
      <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
        {/* Contact Details Surface */}
          <div className="rounded-3xl bg-surface-container p-6 sm:p-8 space-y-5 border-0">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Buyer Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Ramesh Iyer"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                />
                {err("name")}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Company
                </Label>
                <Input
                  id="company"
                  placeholder="e.g. FreshBake Foods"
                  value={form.company}
                  onChange={(e) => set("company")(e.target.value)}
                />
                {err("company")}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98450 00000"
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  onBlur={checkPhone}
                />
                {err("phone")}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lead Source
                </Label>
                <Select value={form.source} onValueChange={set("source")}>
                  <SelectTrigger aria-label="Source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("source")}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lcd" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Contact Date
                </Label>
                <DatePicker
                  id="lcd"
                  max={localToday()}
                  value={form.last_contact_date}
                  onChange={set("last_contact_date")}
                  error={Boolean(errors.last_contact_date)}
                />
                {err("last_contact_date")}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Assigned Sales Rep
                </Label>
                <Select value={form.rep_id} onValueChange={set("rep_id")}>
                  <SelectTrigger aria-label="Sales rep">
                    <SelectValue placeholder={reps.isLoading ? "Loading reps…" : "Select rep"} />
                  </SelectTrigger>
                  <SelectContent>
                    {reps.data?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("rep_id")}
              </div>
            </div>

            {duplicate && (
              <div className="rounded-2xl bg-warm-soft p-4 text-sm text-warm">
                <p className="font-medium">
                  A lead with this phone number already exists: {duplicate.name} ({duplicate.company}).
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3 rounded-full"
                  onClick={() => navigate({ to: "/leads/$id", params: { id: duplicate.id } })}
                >
                  Open existing lead
                </Button>
              </div>
            )}
          </div>

          {/* Conversation History Surface */}
          <div className="rounded-3xl bg-surface-container p-6 sm:p-8 space-y-4 border-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                WhatsApp Conversation <span className="font-normal lowercase opacity-75">(optional)</span>
              </h2>
              <span className="text-xs text-muted-foreground">AI classifies based on chat</span>
            </div>

            <ConversationBuilder
              clientName={form.name}
              repName={reps.data?.find((r) => r.id === form.rep_id)?.name || ""}
              value={form.conversation}
              onChange={set("conversation")}
            />
          </div>

          {/* Form Action Controls */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              className="rounded-full px-8 font-medium gap-2"
              disabled={mutation.isPending || !!duplicate}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving & Analysing…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Save and analyse lead</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="rounded-full"
              onClick={() => navigate({ to: "/leads" })}
            >
              Cancel
            </Button>
          </div>
      </form>
    </div>
  );
}
