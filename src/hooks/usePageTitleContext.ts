import { useContext } from "react";
import { PageTitleContext } from "@/contexts/page-title-context";

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error("usePageTitleContext must be used within a PageTitleProvider");
  }
  return context;
}
