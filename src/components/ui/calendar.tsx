"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-transparent group/calendar p-1 select-none [--cell-size:2.25rem]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-3", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between z-10",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "!size-8 rounded-full !p-0 text-muted-foreground hover:text-foreground hover:!bg-surface-container select-none aria-disabled:opacity-25 aria-disabled:pointer-events-none cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "!size-8 rounded-full !p-0 text-muted-foreground hover:text-foreground hover:!bg-surface-container select-none aria-disabled:opacity-25 aria-disabled:pointer-events-none cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center px-8",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-8 w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none text-sm font-semibold text-foreground tracking-tight",
          captionLayout === "label"
            ? ""
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse border-spacing-y-1",
        weekdays: cn("flex w-full justify-between mb-1", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none text-center text-xs font-medium uppercase tracking-wider py-1",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full justify-between", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center flex items-center justify-center",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "text-foreground",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground/35 aria-selected:text-muted-foreground/50",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground/30 opacity-30 cursor-not-allowed", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers]);

  const isSelected = Boolean(
    modifiers["selected"] &&
    !modifiers["range_start"] &&
    !modifiers["range_end"] &&
    !modifiers["range_middle"],
  );
  const isToday = Boolean(modifiers["today"]);
  const isOutside = Boolean(modifiers["outside"]);
  const isDisabled = Boolean(modifiers["disabled"] || props.disabled);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      disabled={isDisabled}
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSelected}
      data-today={isToday}
      data-outside={isOutside}
      data-range-start={modifiers["range_start"]}
      data-range-end={modifiers["range_end"]}
      data-range-middle={modifiers["range_middle"]}
      className={cn(
        "!size-9 rounded-full font-normal text-xs sm:text-sm transition-all duration-150 !p-0 cursor-pointer",
        // Default text
        "text-foreground hover:!bg-surface-container-highest",
        // Today ring/border when not selected
        isToday && !isSelected && "border border-primary/40 font-bold bg-surface-container-highest/60 text-foreground",
        // Single selected
        isSelected && "!bg-primary !text-primary-foreground font-semibold shadow-sm hover:!bg-primary hover:!text-primary-foreground",
        // Outside current month
        isOutside && "opacity-35 text-muted-foreground hover:opacity-70",
        // Disabled
        isDisabled && "opacity-25 pointer-events-none cursor-not-allowed hover:!bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
