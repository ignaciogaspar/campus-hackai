'use client'

/* Si la barra lateral está plegada y cómo plegarla. Lo da SidebarFrame y lo
   leen la barra (AppNav) y su botón. Va aparte para que la barra y el marco no
   se importen entre sí. */
import { createContext, useContext } from 'react'

type Sidebar = { collapsed: boolean; toggle: () => void }

export const SidebarContext = createContext<Sidebar>({ collapsed: false, toggle: () => {} })

export const useSidebar = () => useContext(SidebarContext)
