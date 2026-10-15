import { useEffect, useState } from "react";
import { localToday } from "@/lib/lead-queries";

/** Today's date (YYYY-MM-DD) in the user's timezone after hydration. */
export function useToday() {
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => setToday(localToday()), []);
  return today;
}
