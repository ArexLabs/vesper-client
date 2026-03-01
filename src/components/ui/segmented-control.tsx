import { cn } from "@/lib/utils";
import type * as React from "react";

type SegmentedItem<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  items: SegmentedItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  items,
  value,
  onValueChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-surface1/70 p-1 shadow-soft",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn(
              "focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
              active
                ? "bg-surface3 text-text shadow-soft"
                : "text-textMuted hover:bg-surface2/70 hover:text-text",
            )}
            onClick={() => onValueChange(item.value)}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
