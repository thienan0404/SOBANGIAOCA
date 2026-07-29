"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RoomTagFilters,
  roomAttentionTagsApi,
} from "@/features/room-attention-tags/api";

export const roomTagKeys = {
  all: ["room-attention-tags"] as const,
  list: (filters: RoomTagFilters) =>
    [...roomTagKeys.all, "list", filters] as const,
  detail: (id: string) => [...roomTagKeys.all, "detail", id] as const,
};

export function useRoomAttentionTags(filters: RoomTagFilters) {
  return useQuery({
    queryKey: roomTagKeys.list(filters),
    queryFn: () => roomAttentionTagsApi.list(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}
export function useRoomAttentionTag(id: string) {
  return useQuery({
    queryKey: roomTagKeys.detail(id),
    queryFn: () => roomAttentionTagsApi.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}