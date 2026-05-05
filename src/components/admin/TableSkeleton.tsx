import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  /** Number of skeleton rows to show (default: 5) */
  rows?: number;
  /** Number of columns to show (default: 4) */
  columns?: number;
  /** Column widths as tailwind classes (optional, cycles if fewer than columns) */
  columnWidths?: string[];
}

/**
 * Skeleton loading state for table-based list pages.
 * Shows a realistic table shape with animated placeholders.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  columnWidths = ["w-[40%]", "w-[25%]", "w-[20%]", "w-[15%]"],
}: TableSkeletonProps) {
  return (
    <Card variant="bordered" className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <TableCell key={colIdx}>
                  <Skeleton
                    className={`h-4 ${columnWidths[colIdx % columnWidths.length]}`}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface CardListSkeletonProps {
  /** Number of skeleton cards to show (default: 4) */
  rows?: number;
}

/**
 * Skeleton loading state for card-based list pages (e.g. Courses).
 */
export function CardListSkeleton({ rows = 4 }: CardListSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} variant="bordered" size="sm">
          <div className="p-4 flex items-center gap-4">
            <Skeleton className="w-10 aspect-[4/5] rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[50%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

interface GridSkeletonProps {
  /** Number of skeleton cards to show (default: 6) */
  items?: number;
}

/**
 * Skeleton loading state for grid-based pages (e.g. Showcases).
 */
export function GridSkeleton({ items = 6 }: GridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: items }).map((_, i) => (
        <Card key={i} variant="bordered" className="overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-[60%]" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
        </Card>
      ))}
    </div>
  );
}
