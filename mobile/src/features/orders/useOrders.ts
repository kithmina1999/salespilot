import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { Order, OrdersResponse, OrderStatus } from "@/api/types";

export const orderStatuses: Array<{ label: string; value?: OrderStatus }> = [
  { label: "All" },
  { label: "New", value: "new" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" }
];

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: queryKeys.orders(status),
    queryFn: async () => {
      const qs = status ? `?status=${status}` : "";
      const data = await apiFetch<OrdersResponse>(`/api/v1/orders${qs}`);
      return data.orders;
    }
  });
}

export function useOrder(id: number) {
  const allOrders = useQueryClient().getQueriesData<Order[]>({
    queryKey: ["orders"]
  });

  return allOrders.flatMap(([, orders]) => orders ?? []).find((order) => order.id === id);
}

export function useUpdateOrderStatus(status?: OrderStatus) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { order: Order; status: OrderStatus; cancelReason?: string }) =>
      apiFetch<{ order: Order; message: string }>(`/api/v1/orders/${input.order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: input.status,
          cancel_reason: input.cancelReason
        })
      }),
    onMutate: async (input) => {
      const key = queryKeys.orders(status);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Order[]>(key);
      queryClient.setQueryData<Order[]>(key, (orders = []) =>
        orders.map((order) =>
          order.id === input.order.id ? { ...order, status: input.status } : order
        )
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(queryKeys.orders(status), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap });
    }
  });
}
