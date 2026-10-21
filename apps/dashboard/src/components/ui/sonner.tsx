import { useTheme } from "@/lib/theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircleIcon as CircleCheckIcon, InfoCircleIcon as InfoIcon, DangerTriangleIcon as TriangleAlertIcon, CloseCircleIcon as OctagonXIcon, LoaderIcon as Loader2Icon, CloseIcon as XIcon } from '@solar-icons/react/linear'
import type { ReactNode } from "react"

/** The status icon in a soft ring (halo), like the dvote alerts. */
const Halo = ({ tone, children }: { tone: string; children: ReactNode }) => (
  <span className={`flex size-8 animate-in items-center justify-center rounded-full ring-4 duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] zoom-in-50 fade-in-0 ${tone}`}>{children}</span>
)

/**
 * dvote toasts: a card with the status icon in a ring, a bold title, muted text, a close
 * button, and actions (cancel = quiet, action = strong) on their own line under the text.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      // Sonner sets its own system font on the container: use the dashboard's (Inter / Cairo)
      style={{ fontFamily: "inherit" }}
      closeButton
      icons={{
        success: (
          <Halo tone="bg-success-soft text-success ring-success-soft/50">
            <CircleCheckIcon className="size-4.5" />
          </Halo>
        ),
        info: (
          <Halo tone="bg-muted text-foreground ring-muted/60">
            <InfoIcon className="size-4.5" />
          </Halo>
        ),
        warning: (
          <Halo tone="bg-warning-soft text-warning ring-warning-soft/50">
            <TriangleAlertIcon className="size-4.5" />
          </Halo>
        ),
        error: (
          <Halo tone="bg-destructive-soft text-destructive ring-destructive-soft/50">
            <OctagonXIcon className="size-4.5" />
          </Halo>
        ),
        close: <XIcon className="size-4" strokeWidth={2} />,
        loading: (
          <Halo tone="bg-muted text-muted-foreground ring-muted/60">
            <Loader2Icon className="size-4.5 animate-spin" />
          </Halo>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group/toast relative flex w-(--width) flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card p-4 pe-10 text-card-foreground shadow-lg ring-1 ring-foreground/10 data-[expanded=false]:data-[front=false]:overflow-hidden data-[expanded=false]:data-[front=false]:*:opacity-0",
          icon: "m-0 flex size-8 shrink-0 items-center justify-center",
          content: "grid min-w-0 flex-1 basis-[calc(100%-2.75rem)] gap-0.5",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          closeButton:
            "absolute end-2.5 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          // buttons wrap under the text, lined up with it (icon 2rem + gap 0.75rem = ms-11)
          cancelButton: "ms-11 inline-flex w-fit text-sm font-medium text-muted-foreground hover:text-foreground",
          actionButton: "ms-11 inline-flex w-fit text-sm font-semibold text-foreground hover:underline [[data-cancel]~&]:ms-1",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
