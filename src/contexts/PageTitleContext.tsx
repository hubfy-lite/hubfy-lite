import { useCallback, useMemo, useState, type ReactNode } from "react";
import { PageTitleContext, type PageTitleContextValue } from "@/contexts/page-title-context";

interface TitleOverride {
  owner: symbol;
  value: string;
}

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [titleOverride, setTitleOverrideState] = useState<TitleOverride | null>(null);

  const setTitleOverride = useCallback((owner: symbol, value: string | null) => {
    setTitleOverrideState((current) => {
      if (!value) {
        return current?.owner === owner ? null : current;
      }
      return { owner, value };
    });
  }, []);

  const clearTitleOverride = useCallback((owner: symbol) => {
    setTitleOverrideState((current) => (current?.owner === owner ? null : current));
  }, []);

  const value = useMemo<PageTitleContextValue>(
    () => ({
      titleOverride: titleOverride?.value ?? null,
      setTitleOverride,
      clearTitleOverride,
    }),
    [titleOverride, setTitleOverride, clearTitleOverride],
  );

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}
