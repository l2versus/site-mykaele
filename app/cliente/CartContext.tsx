'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface CartItem {
  id: string
  packageOptionId: string
  name: string
  sessions: number
  price: number
  serviceId: string
  serviceName: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (packageOptionId: string) => void
  clearCart: () => void
  total: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      // Check if item already exists
      const existing = prev.find((i) => i.packageOptionId === item.packageOptionId)
      if (existing) {
        // Update quantity if already in cart
        return prev.map((i) =>
          i.packageOptionId === item.packageOptionId
            ? { ...i, sessions: i.sessions + item.sessions }
            : i
        )
      }
      return [...prev, item]
    })
  }

  const removeItem = (packageOptionId: string) => {
    setItems((prev) => prev.filter((i) => i.packageOptionId !== packageOptionId))
  }

  const clearCart = () => {
    setItems([])
  }

  const total = items.reduce((sum, item) => sum + item.price, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
