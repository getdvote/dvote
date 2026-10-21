import * as React from "react"
import { cn } from "cn"

/** Fixed-height text box (scrolls when full). With `maxLength`, a "12 / 500" counter shows under it. */
function Textarea({ className, maxLength, onChange, ...props }: React.ComponentProps<"textarea">) {
  const [typed, setTyped] = React.useState(() => String(props.value ?? props.defaultValue ?? "").length)
  // controlled boxes follow their value; uncontrolled ones count what was typed
  const length = props.value !== undefined ? String(props.value).length : typed
  const box = (
    <textarea
      data-slot="textarea"
      maxLength={maxLength}
      onChange={(e) => {
        setTyped(e.target.value.length)
        onChange?.(e)
      }}
      className={cn(
        "flex min-h-16 w-full resize-none overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
  if (!maxLength) return box
  return (
    <div className="grid w-full gap-1">
      {box}
      <span
        dir="ltr"
        aria-live="polite"
        className={cn(
          "justify-self-end text-xs text-muted-foreground tabular-nums",
          length >= maxLength * 0.9 && "text-warning",
          length >= maxLength && "text-destructive"
        )}
      >
        {length} / {maxLength}
      </span>
    </div>
  )
}

export { Textarea }
