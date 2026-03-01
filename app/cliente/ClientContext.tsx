'use client'

import { createContext, useContext } from 'react'

export interface ClientUser {
  id: string
  name: string
  email: string
  phone?: string
  cpfRg?: string
  address?: string
  role: string
  avatar?: string
  forcePasswordChange?: boolean
}

export interface ClientContextType {
  user: ClientUser | null
  token: string | null
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  logout: () => void
  refreshUser: () => void
}

const ClientContext = createContext<ClientContextType>({
  user: null,
  token: null,
  fetchWithAuth: async () => new Response(),
  logout: () => {},
  refreshUser: () => {},
})

export const useClient = () => useContext(ClientContext)
export const ClientContextProvider = ClientContext.Provider
