import { useEffect, useRef } from "react";
import { usePageTitleContext } from "@/hooks/usePageTitleContext";

export function usePageTitle(title: string | null | undefined) {
  const { setTitleOverride, clearTitleOverride } = usePageTitleContext();
  const ownerRef = useRef(Symbol("page-title"));

  useEffect(() => {
    const owner = ownerRef.current;

    if (!title) {
      clearTitleOverride(owner);
      return;
    }

    setTitleOverride(owner, title);
    return () => {
      clearTitleOverride(owner);
    };
  }, [title, setTitleOverride, clearTitleOverride]);
}
