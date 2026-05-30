'use client';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TableStatus } from '@dineflow/types';
import { Order } from '@dineflow/types';

// ─── Local Types ──────────────────────────────────────────────────────────────

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  name: string;
  section?: string;
  capacity: number;
  table_type: 'INDOOR' | 'OUTDOOR' | 'BAR' | 'PRIVATE';
  status: TableStatus;
  current_order_id?: string;
  current_session_id?: string;
  covers?: number;
  occupied_since?: string;
  bill_total?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // enriched locally
  qr_count?: number;
}

export interface QRCode {
  id: string;
  restaurant_id: string;
  table_id?: string;
  name: string;
  url: string;
  total_scans: number;
  last_scanned_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QRImageResponse {
  qr_image: string; // base64
  url: string;
}

export interface CreateTablePayload {
  name: string;
  section?: string;
  capacity: number;
  table_type?: RestaurantTable['table_type'];
  notes?: string;
  generate_qr?: boolean;
}

export interface UpdateTablePayload {
  name?: string;
  section?: string;
  capacity?: number;
  table_type?: RestaurantTable['table_type'];
  notes?: string;
}

export interface CreateQRPayload {
  table_id: string;
  name?: string;
}

export interface BulkCreateQRPayload {
  tableIds: string[];
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const tableKeys = {
  all: ['tables'] as const,
  orders: (tableId: string) => ['table-orders', tableId] as const,
};

export const qrKeys = {
  all: ['qr-codes'] as const,
  image: (id: string) => ['qr-image', id] as const,
};

// ─── Tables hooks ─────────────────────────────────────────────────────────────

export function useTables(): UseQueryResult<RestaurantTable[]> {
  return useQuery<RestaurantTable[]>({
    queryKey: tableKeys.all,
    queryFn: () => api.get('/tables').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useTableOrders(tableId: string | null) {
  return useQuery<Order[]>({
    queryKey: tableKeys.orders(tableId ?? ''),
    queryFn: () =>
      api
        .get('/orders', { params: { tableId, status: 'active' } })
        .then((r) => r.data),
    enabled: !!tableId,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation<RestaurantTable, unknown, CreateTablePayload>({
    mutationFn: (payload) => api.post('/tables', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation<RestaurantTable, unknown, { id: string; payload: UpdateTablePayload }>({
    mutationFn: ({ id, payload }) =>
      api.patch(`/tables/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: (id) => api.delete(`/tables/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export function useUpdateTableStatus() {
  const qc = useQueryClient();
  return useMutation<RestaurantTable, unknown, { id: string; status: TableStatus }>({
    mutationFn: ({ id, status }) =>
      api.patch(`/tables/${id}/status`, { status }).then((r) => r.data),
    // Optimistic update
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: tableKeys.all });
      const prev = qc.getQueryData<RestaurantTable[]>(tableKeys.all);
      qc.setQueryData<RestaurantTable[]>(tableKeys.all, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { prev?: RestaurantTable[] } | undefined;
      if (context?.prev) {
        qc.setQueryData(tableKeys.all, context.prev);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

// ─── QR hooks ─────────────────────────────────────────────────────────────────

export function useQRCodes(): UseQueryResult<QRCode[]> {
  return useQuery<QRCode[]>({
    queryKey: qrKeys.all,
    queryFn: () => api.get('/qr').then((r) => r.data),
  });
}

export function useQRImage(id: string | null) {
  return useQuery<QRImageResponse>({
    queryKey: qrKeys.image(id ?? ''),
    queryFn: () => api.get(`/qr/${id}/image`).then((r) => r.data),
    enabled: !!id,
    staleTime: Infinity, // images don't change
  });
}

export function useCreateQR() {
  const qc = useQueryClient();
  return useMutation<QRCode, unknown, CreateQRPayload>({
    mutationFn: (payload) => api.post('/qr', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qrKeys.all }),
  });
}

export function useBulkCreateQR() {
  const qc = useQueryClient();
  return useMutation<QRCode[], unknown, BulkCreateQRPayload>({
    mutationFn: (payload) =>
      api.post('/qr/bulk', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qrKeys.all });
      qc.invalidateQueries({ queryKey: tableKeys.all });
    },
  });
}

export function useDisableQR() {
  const qc = useQueryClient();
  return useMutation<QRCode, unknown, { id: string; enable: boolean }>({
    mutationFn: ({ id, enable }) =>
      api
        .post(`/qr/${id}/${enable ? 'enable' : 'disable'}`, {})
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qrKeys.all }),
  });
}

export function useDeleteQR() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: (id) => api.delete(`/qr/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qrKeys.all }),
  });
}
