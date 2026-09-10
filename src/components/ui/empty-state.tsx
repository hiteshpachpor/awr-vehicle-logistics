import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center p-6 text-center", className)}>
      <div className="max-w-sm">
        <span className="mb-3 flex justify-center text-muted-foreground [&>svg]:size-7">
          {icon}
        </span>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}
