"use client";

import { useMemo, useState } from "react";
import {
  CaretUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

export function SearchSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  id,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  searchPlaceholder: string;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.description, option.searchText]
        .filter(Boolean)
        .some((part) => part!.toLocaleLowerCase().includes(normalized)),
    );
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-11 w-full justify-between px-3 py-2 text-left font-normal"
          disabled={disabled}
        >
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate",
                !selected && "text-muted-foreground",
              )}
            >
              {selected?.label ?? placeholder}
            </span>
            {selected?.description ? (
              <span className="block truncate text-xs text-muted-foreground">
                {selected.description}
              </span>
            ) : null}
          </span>
          <CaretUpDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <MagnifyingGlassIcon
            size={16}
            className="shrink-0 text-muted-foreground"
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
          aria-label={placeholder}
        >
          {filtered.length ? (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <CheckIcon
                  size={16}
                  weight="bold"
                  className={cn(
                    "mt-0.5 shrink-0",
                    option.value === value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches found.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
