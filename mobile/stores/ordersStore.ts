import { create } from 'zustand';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
}

export interface Order {
  localId: string;
  orderId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

interface OrdersState {
  orders: Order[];
  addOrder: (order: Order) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
}));
