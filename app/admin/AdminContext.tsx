'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface AdminUser { 
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export interface AdminContextType { 
  user: AdminUser | null
  token: string | null
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  logout: () => void
}

const AdminContext = createContext<AdminContextType>({
  user: null,
  token: null,
  fetchWithAuth: async () => new Response(),
  logout: () => {},
})

export const useAdmin = () => useContext(AdminContext)
export const AdminContextProvider = AdminContext.Provider
