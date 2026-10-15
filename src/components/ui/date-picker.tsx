"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  id?: string;
  name?: string;
  /** ISO format: YYYY-MM-DD */
  value?: string;
  /** Emits ISO format: YYYY-MM-DD */
  onChange?: (val: string) => void;
  /** Max selectable date as ISO string (e.g. localToday()) */
  max?: string;
  /** Min selectable date as ISO string */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  "aria-label"?: string;
}

/**
 * Safely parse a YYYY-MM-DD string into a local midnight Date.
 * Avoids UTC timezone conversion shifts.
 */
function parseLocalDate(val?: string | null): Date | undefined {
  if (!val || typeof val !== "string") return undefined;
  const parts = val.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return undefined;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Formats a Date object to dd/mm/yyyy string.
 */
function formatToDdMmYyyy(date?: Date | null): string {
  if (!date || isNaN(date.getTime())) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Formats a Date to YYYY-MM-DD string.
 */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      id,
      name,
      value,
      onChange,
      max,
      min,
      placeholder = "dd/mm/yyyy",
      disabled = false,
      className,
      error = false,
      "aria-label": ariaLabel,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);

    const selectedDate = React.useMemo(() => parseLocalDate(value), [value]);
    const maxDate = React.useMemo(() => parseLocalDate(max), [max]);
    const minDate = React.useMemo(() => parseLocalDate(min), [min]);

    const displayDate = React.useMemo(
      () => (selectedDate ? formatToDdMmYyyy(selectedDate) : ""),
      [selectedDate],
    );

    const handleSelect = React.useCallback(
      (date: Date | undefined) => {
        if (!date) {
          onChange?.("");
          return;
        }
        onChange?.(toIsoDate(date));
        setOpen(false);
      },
      [onChange],
    );

    const isDayDisabled = React.useCallback(
      (date: Date) => {
        if (maxDate) {
          const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const m = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
          if (d > m) return true;
        }
        if (minDate) {
          const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const mn = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
          if (d < mn) return true;
        }
        return false;
      },
      [maxDate, minDate],
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            name={name}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel || (displayDate ? `Date: ${displayDate}` : "Select date in dd/mm/yyyy format")}
            disabled={disabled}
            className={cn(
              "group flex h-11 w-full items-center justify-between rounded-2xl border-0 bg-surface-container-highest px-4 py-2 text-sm text-foreground ring-offset-background transition-all duration-150 cursor-pointer",
              "hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-high",
              "disabled:cursor-not-allowed disabled:opacity-40",
              error && "ring-2 ring-destructive",
              className,
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              {displayDate ? (
                <span className="font-medium text-foreground tracking-wide font-mono text-xs sm:text-sm">
                  {displayDate}
                </span>
              ) : (
                <span className="text-muted-foreground font-mono text-xs sm:text-sm">
                  {placeholder}
                </span>
              )}
            </div>

            <ChevronDown
              className={cn(
                "size-4 opacity-50 transition-transform duration-200 text-muted-foreground",
                open && "rotate-180 text-foreground opacity-90",
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-auto p-3 rounded-3xl bg-surface-container-high border border-surface-container-highest/80 shadow-2xl backdrop-blur-md z-[70]"
        >

          {/* Theme-matching Calendar */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={isDayDisabled}
            defaultMonth={selectedDate || maxDate || new Date()}
          />
        </PopoverContent>
      </Popover>
    );
  },
);

DatePicker.displayName = "DatePicker";
