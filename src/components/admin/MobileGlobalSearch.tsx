import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SearchResults } from "@/components/admin/SearchResults";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Command, CommandInput } from "@/components/ui/command";

export function MobileGlobalSearch() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { query, setQuery, grouped, isLoading, reset, recentQueries, saveRecent } = useGlobalSearch();

  // Reset search when drawer closes
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleSelect = (url: string) => {
    saveRecent();
    setOpen(false);
    reset();
    navigate(url);
  };

  const handleRecentClick = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon">
          <Search className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle className="sr-only">{t("search.placeholder")}</DrawerTitle>

        <Command shouldFilter={false} className="rounded-t-[10px]">
          <CommandInput
            placeholder={t("search.placeholder")}
            value={query}
            onValueChange={setQuery}
          />
          <SearchResults
            query={query}
            grouped={grouped}
            isLoading={isLoading}
            onSelect={handleSelect}
            recentQueries={recentQueries}
            onRecentClick={handleRecentClick}
            className="max-h-[60vh]"
            showHint
          />
        </Command>
      </DrawerContent>
    </Drawer>
  );
}
