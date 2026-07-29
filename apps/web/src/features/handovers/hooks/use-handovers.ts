"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { handoverApi } from "../api/handovers";

export const handoverKeys = {
  all: ["handovers"] as const,
  list: (branchId?: string) =>
    [...handoverKeys.all, "list", branchId ?? "all"] as const,
  detail: (id: string) => [...handoverKeys.all, "detail", id] as const,
  participants: ["handover-participants"] as const,
};

export function useHandovers() {
  const branchId =
    typeof window === "undefined"
      ? undefined
      : localStorage.getItem("a25.branchId") ?? undefined;
  return useQuery({
    queryKey: handoverKeys.list(branchId),
    queryFn: () => handoverApi.list(branchId),
  });
}

export function useHandover(id: string) {
  return useQuery({
    queryKey: handoverKeys.detail(id),
    queryFn: () => handoverApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: handoverApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: handoverKeys.all }),
  });
}