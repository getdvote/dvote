import * as React from "react"
import { cn } from "cn"

/**
 * Below 768px, styles.css stacks each body row into a card. This copies every
 * header's text onto its column's cells (data-label) and marks the card heading
 * and actions cells (data-cell-role) so pages don't repeat the labels by hand.
 * The heading is the first column unless a TableHead sets data-card="primary";
 * a header with no text is the actions column. data-card on a cell overrides it
 * (data-card="fill" lets a bar or chart value take the free width).
 */
function useStackedRows() {
  return React.useCallback((table: HTMLTableElement | null) => {
    if (!table) return
    const label = () => {
      const columns: { text: string; card?: string }[] = []
      table.querySelectorAll(":scope > thead > tr:last-child > th").forEach((th) => {
        const head = th as HTMLTableCellElement
        for (let i = 0; i < head.colSpan; i++) {
          columns.push({ text: head.textContent?.trim() ?? "", card: head.dataset.card })
        }
      })
      const primary = Math.max(0, columns.findIndex((c) => c.card === "primary"))
      table.querySelectorAll(":scope > tbody > tr").forEach((tr) => {
        let col = 0
        for (const cell of Array.from(tr.children) as HTMLTableCellElement[]) {
          const column = columns[col]
          const spans = cell.colSpan > 1
          const role = spans
            ? "full"
            : cell.dataset.card ?? (col === primary ? "primary" : column && !column.text ? "actions" : column?.card)
          setAttr(cell, "data-label", spans ? undefined : column?.text || undefined)
          setAttr(cell, "data-cell-role", role)
          col += cell.colSpan
        }
      })
    }
    label()
    const observer = new MutationObserver(label)
    observer.observe(table, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
}

function setAttr(el: Element, name: string, value: string | undefined) {
  if (value === undefined) {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value)
  }
}

function Table({ className, ref, ...props }: React.ComponentProps<"table">) {
  const stackedRows = useStackedRows()
  const tableRef = React.useCallback(
    (node: HTMLTableElement | null) => {
      const cleanup = stackedRows(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
      return () => {
        cleanup?.()
        if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [stackedRows, ref]
  )
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-start align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  useStackedRows,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
