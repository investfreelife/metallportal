"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

// Two separate contexts to avoid re-render loops:
// writers subscribe to SetCtx (stable), readers subscribe to ContentCtx (changes)
const SetCtx = createContext<(n: React.ReactNode) => void>(() => {});
const ContentCtx = createContext<React.ReactNode>(null);

export function CatalogFiltersProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<React.ReactNode>(null);
  const set = useCallback((n: React.ReactNode) => setContent(n), []);
  return (
    <SetCtx.Provider value={set}>
      <ContentCtx.Provider value={content}>
        {children}
      </ContentCtx.Provider>
    </SetCtx.Provider>
  );
}

/** CatalogView uses this to push filter panel — does NOT re-render on content change */
export const useSetCatalogFilters = () => useContext(SetCtx);

/** CatalogSidebar uses this to render filter panel */
export const useCatalogFiltersContent = () => useContext(ContentCtx);
