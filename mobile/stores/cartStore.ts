import { create } from 'zustand'

interface CartItem {
  productId: string
  name: string
  article: string
  quantity: number
  unit: string
  price: number | null
  supplierId: string
}

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => set((state) => {
    const exists = state.items.find(i => i.productId === item.productId)
    if (exists) {
      return {
        items: state.items.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }
    }
    return { items: [...state.items, item] }
  }),

  removeItem: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),

  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i =>
      i.productId === productId ? { ...i, quantity } : i
    )
  })),

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, item) =>
    sum + (item.price ?? 0) * item.quantity, 0
  ),
}))
