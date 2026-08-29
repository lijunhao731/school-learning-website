import { create } from "zustand";

interface KnowledgeState {
  selectedKpId: number | null;
  setSelectedKpId: (id: number | null) => void;
  expandedNodes: Set<number>;
  toggleNode: (id: number) => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  selectedKpId: null,
  setSelectedKpId: (id) => set({ selectedKpId: id }),
  expandedNodes: new Set(),
  toggleNode: (id) =>
    set((state) => {
      const next = new Set(state.expandedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedNodes: next };
    }),
}));
