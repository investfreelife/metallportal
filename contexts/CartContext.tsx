"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  id: string;
  name: string;
  slug: string;
  unit: string | null;
  price: number | null;
  quantity: number;
  image_url: string | null;
  meters?: number;
  tons?: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: CartItem[]) => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      const next = existing
        ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { ...item, quantity: 1 }];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    persist(items.filter(i => i.id !== id));
  }, [items]);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty < 1) return;
    persist(items.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }, [items]);

  const clearCart = useCallback(() => persist([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, addItem, removeItem, updateQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
