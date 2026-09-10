import * as React from "react";

export function FormField({
  label,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {helper ? (
        <p
          id={`${htmlFor}-description`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}
