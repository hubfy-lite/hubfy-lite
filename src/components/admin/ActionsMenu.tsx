import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionsMenuProps {
  items: (ActionItem | false | null | undefined)[];
}

export function ActionsMenu({ items: rawItems }: ActionsMenuProps) {
  const items = rawItems.filter(Boolean) as ActionItem[];
  // Insert separator before first destructive item
  const firstDestructiveIndex = items.findIndex((item) => item.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, index) => (
          <span key={index}>
            {index === firstDestructiveIndex && firstDestructiveIndex > 0 && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              onClick={item.onClick}
              disabled={item.disabled}
              className={
                item.destructive
                  ? "text-destructive focus:text-destructive"
                  : undefined
              }
            >
              {item.icon && <span className="mr-2 shrink-0">{item.icon}</span>}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
