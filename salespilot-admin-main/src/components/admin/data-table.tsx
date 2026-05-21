import type { ReactNode } from "react"
import { type LucideIcon } from "lucide-react"

import { AdminEmptyState, AdminSkeleton } from "@/components/admin/page"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type AdminDataTableColumn = {
  key: string
  header: ReactNode
  className?: string
}

function AdminDataTable({
  columns,
  children,
  isLoading,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  minWidth = "900px",
  loadingRows = 5,
  className,
}: {
  columns: AdminDataTableColumn[]
  children: ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription?: ReactNode
  minWidth?: string
  loadingRows?: number
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/90 shadow-sm", className)}>
      <CardContent className="p-0">
        <Table style={{ minWidth }}>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "h-10 px-4 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground",
                    column.className
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-4">
                  <div className="flex flex-col gap-2">
                    {[...Array(loadingRows)].map((_, index) => (
                      <AdminSkeleton key={index} className="h-12" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : isEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="border-b-0 p-0">
                  <AdminEmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            ) : (
              children
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export { AdminDataTable, type AdminDataTableColumn }
