export type ParsedMessage = { sender: "buyer" | "rep"; body: string; sent_at: string };

// Matches "[14/10/2026, 10:23] Name: text", "[14/10/26, 10:23:45 AM] Name: text",
// "14/10/2026, 10:23 - Name: text"
const LINE_RE =
  /^\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\]?\s*(?:-\s*)?([^:]{1,40}):\s*(.*)$/;
const SIMPLE_RE = /^([^:\n]{1,40}):\s*(.+)$/;

function isRep(name: string, repName: string) {
  const n = name.trim().toLowerCase();
  if (["me", "you", "rep", "sales", "sales rep"].includes(n)) return true;
  const rep = repName.toLowerCase();
  return n === rep || n === rep.split(" ")[0];
}

/** Parse pasted WhatsApp text. fallbackDate is used for lines without a timestamp. */
export function parseWhatsApp(text: string, repName: string, fallbackDate: string): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let minute = 0;
  for (const raw of lines) {
    const line = raw.replace(/[\u200e\u200f]/g, "").trim();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (m) {
      const [, dd = "", mm = "", yy = "", hh = "", mi = "", ampm, name = "", body = ""] = m;
      let hour = Number(hh);
      if (ampm) {
        const pm = ampm.toLowerCase() === "pm";
        if (pm && hour < 12) hour += 12;
        if (!pm && hour === 12) hour = 0;
      }
      const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      const iso = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${mi}:00Z`;
      if (!isNaN(Date.parse(iso))) {
        out.push({ sender: isRep(name, repName) ? "rep" : "buyer", body: body.trim(), sent_at: iso });
        continue;
      }
    }
    const s = line.match(SIMPLE_RE);
    if (s && s[1] && s[2] && !/^https?$/i.test(s[1])) {
      const t = new Date(`${fallbackDate}T09:00:00Z`);
      t.setUTCMinutes(minute++);
      out.push({ sender: isRep(s[1], repName) ? "rep" : "buyer", body: s[2].trim(), sent_at: t.toISOString() });
      continue;
    }
    if (out.length) out[out.length - 1]!.body += "\n" + line;
    else {
      const t = new Date(`${fallbackDate}T09:00:00Z`);
      t.setUTCMinutes(minute++);
      out.push({ sender: "buyer", body: line, sent_at: t.toISOString() });
    }
  }
  return out.filter((m) => m.body.length > 0);
}
