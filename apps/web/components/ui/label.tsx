import * as React from "react";
import { cn } from "@/lib/utils";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  ),
);
Label.displayName = "Label";
