'use client';
import {
  useQuery, useMutation, useQueryClient, UseQueryResult
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  MenuCategory, MenuItem, MenuTranslation
} from '@dineflow/types';

// ─── Query keys ───────────────────────────────────────────────────────────────
export const menuKeys = {
  all:          ['menu'] as const,
  categories:   () => [...menuKeys.all, 'categories'] as const,
  items:        (categoryId: string) => [...menuKeys.all, 'items', categoryId] as const,
  item:         (itemId: string) => [...menuKeys.all, 'item', itemId] as const,
  translations: (itemId: string) => [...menuKeys.all, 'translations', itemId] as const,
  collections:  () => [...menuKeys.all, 'collections'] as const,
};

// ─── Categories ───────────────────────────────────────────────────────────────
export function useCategories(): UseQueryResult<MenuCategory[]> {
  return useQuery({
    queryKey: menuKeys.categories(),
    queryFn: () => api.get('/menu/categories').then(r => r.data),
    staleTime: 60_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post('/menu/categories', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: menuKeys.categories() }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; is_active?: boolean }) =>
      api.patch(`/menu/categories/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: menuKeys.categories() }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/menu/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: menuKeys.categories() }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string[], { prev?: MenuCategory[] }>({
    mutationFn: (ids: string[]) =>
      api.post('/menu/categories/reorder', { ids }).then(r => r.data),
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: menuKeys.categories() });
      const prev = qc.getQueryData<MenuCategory[]>(menuKeys.categories());
      if (prev) {
        const reordered = ids.map((id: string, i: number) => {
          const cat = prev.find(c => c.id === id)!;
          return { ...cat, sort_order: i };
        });
        qc.setQueryData(menuKeys.categories(), reordered);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) =>
      qc.setQueryData(menuKeys.categories(), ctx?.prev),
  });
}

// ─── Items ────────────────────────────────────────────────────────────────────
export function useItems(categoryId: string | null) {
  return useQuery<MenuItem[]>({
    queryKey: menuKeys.items(categoryId ?? ''),
    queryFn: () =>
      api.get(`/menu/items?categoryId=${categoryId}`).then(r => r.data),
    enabled: !!categoryId,
    staleTime: 30_000,
  });
}

export function useItem(itemId: string | null) {
  return useQuery<MenuItem>({
    queryKey: menuKeys.item(itemId ?? ''),
    queryFn: () => api.get(`/menu/items/${itemId}`).then(r => r.data),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MenuItem> & { category_id: string }) =>
      api.post('/menu/items', data).then(r => r.data),
    onSuccess: (_data: MenuItem, vars: Partial<MenuItem> & { category_id: string }) => {
      qc.invalidateQueries({ queryKey: menuKeys.items(vars.category_id) });
      qc.invalidateQueries({ queryKey: menuKeys.categories() });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<MenuItem> & { id: string }) =>
      api.patch(`/menu/items/${id}`, data).then(r => r.data),
    onSuccess: (data: MenuItem) => {
      qc.invalidateQueries({ queryKey: menuKeys.item(data.id) });
      qc.invalidateQueries({ queryKey: menuKeys.items(data.category_id) });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; categoryId: string }) =>
      api.delete(`/menu/items/${id}`),
    onSuccess: (_d: unknown, { categoryId }: { id: string; categoryId: string }) => {
      qc.invalidateQueries({ queryKey: menuKeys.items(categoryId) });
      qc.invalidateQueries({ queryKey: menuKeys.categories() });
    },
  });
}

export function useToggleAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; categoryId: string }) =>
      api.patch(`/menu/items/${id}/toggle`).then(r => r.data),
    onMutate: async ({ id, categoryId }: { id: string; categoryId: string }) => {
      await qc.cancelQueries({ queryKey: menuKeys.items(categoryId) });
      const prev = qc.getQueryData<MenuItem[]>(menuKeys.items(categoryId));
      qc.setQueryData(menuKeys.items(categoryId), (old: MenuItem[] | undefined) =>
        old?.map(item => item.id === id
          ? { ...item, is_available: !item.is_available }
          : item
        )
      );
      return { prev };
    },
    onError: (_e: unknown, { categoryId }: { id: string; categoryId: string }, ctx: { prev?: MenuItem[] } | undefined) =>
      qc.setQueryData(menuKeys.items(categoryId), ctx?.prev),
  });
}

// ─── Translations ─────────────────────────────────────────────────────────────
export function useTranslations(itemId: string | null) {
  return useQuery<MenuTranslation[]>({
    queryKey: menuKeys.translations(itemId ?? ''),
    queryFn: () =>
      api.get(`/menu/items/${itemId}/translations`).then(r => r.data),
    enabled: !!itemId,
    staleTime: 120_000,
  });
}

export function useUpdateTranslation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, lang, name, description }:
      { itemId: string; lang: string; name: string; description?: string }) =>
      api.patch(`/menu/items/${itemId}/translations/${lang}`, { name, description }),
    onSuccess: (_d: unknown, { itemId }: { itemId: string; lang: string; name: string; description?: string }) =>
      qc.invalidateQueries({ queryKey: menuKeys.translations(itemId) }),
  });
}

// ─── Image upload ─────────────────────────────────────────────────────────────
export function useUploadItemImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, file }: { itemId: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/upload/menu-item/${itemId}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    },
    onSuccess: (data: unknown, { itemId }: { itemId: string; file: File }) => {
      const d = data as { public_id?: string; category_id?: string };
      // Invalidate the single-item detail cache
      qc.invalidateQueries({ queryKey: menuKeys.item(itemId) });
      // Also patch the image_public_id in every items-list cache entry so the
      // card thumbnail updates immediately without waiting for a full list refetch
      qc.getQueriesData<MenuItem[]>({ queryKey: [...menuKeys.all, 'items'] })
        .forEach(([queryKey, items]) => {
          if (!items) return;
          const updated = items.map(i =>
            i.id === itemId && d?.public_id
              ? { ...i, image_public_id: d.public_id }
              : i,
          );
          qc.setQueryData(queryKey, updated);
        });
    },
  });
}

// ─── Collections ──────────────────────────────────────────────────────────────
export function useCollections() {
  return useQuery({
    queryKey: menuKeys.collections(),
    queryFn: () => api.get('/menu/collections').then(r => r.data),
    staleTime: 60_000,
  });
}
