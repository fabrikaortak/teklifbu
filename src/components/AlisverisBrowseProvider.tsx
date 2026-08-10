"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { seedAlisverisBrowseTree } from "@/hooks/alisverisBrowseClientCache";

const AlisverisBrowseInitialContext = createContext<BrowseNode[] | null>(null);

export function AlisverisBrowseProvider({
  initialTree,
  children,
}: {
  initialTree: BrowseNode[] | null;
  children: ReactNode;
}) {
  const seeded = useRef(false);
  if (!seeded.current && initialTree?.length) {
    seedAlisverisBrowseTree(initialTree);
    seeded.current = true;
  }

  return (
    <AlisverisBrowseInitialContext.Provider value={initialTree}>
      {children}
    </AlisverisBrowseInitialContext.Provider>
  );
}

export function useAlisverisBrowseInitial(): BrowseNode[] | null {
  return useContext(AlisverisBrowseInitialContext);
}
