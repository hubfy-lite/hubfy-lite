import { createContext } from "react";

export interface PageTitleContextValue {
  titleOverride: string | null;
  setTitleOverride: (owner: symbol, value: string | null) => void;
  clearTitleOverride: (owner: symbol) => void;
}

export const PageTitleContext = createContext<PageTitleContextValue | undefined>(undefined);
