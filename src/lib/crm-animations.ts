// src/lib/crm-animations.ts — Variantes de animação Framer Motion para CRM

import type { Variants } from 'framer-motion'

/** Física de mola premium — stiffness 400, damping 25, mass 1.2 */
const SPRING = { type: 'spring' as const, stiffness: 400, damping: 25, mass: 1.2 }

/** Variantes do card durante arraste */
export const cardDragVariants: Variants = {
  idle: {
    scale: 1,
    rotate: 0,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    zIndex: 0,
    transition: SPRING,
  },
  dragging: {
    scale: 1.04,
    rotate: 1.5,
    boxShadow: '0 25px 50px rgba(0,0,0,0.45)',
    zIndex: 50,
    transition: SPRING,
  },
  dropping: {
    scale: 1,
    rotate: 0,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    zIndex: 0,
    transition: { ...SPRING, stiffness: 300 },
  },
}

/** Variantes dos cards vizinhos durante arraste (blur + fade) */
export const siblingCardVariants: Variants = {
  idle: {
    filter: 'blur(0px)',
    opacity: 1,
    transition: { duration: 0.2 },
  },
  dimmed: {
    filter: 'blur(1.5px)',
    opacity: 0.4,
    transition: { duration: 0.15 },
  },
}

/** Variantes para entrada de card na coluna */
export const cardEnterVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15 },
  },
}

/** Variantes para coluna do pipeline */
export const columnVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...SPRING, delay: i * 0.05 },
  }),
}

/** Variantes para drawer lateral */
export const drawerVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: SPRING,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2 },
  },
}

/** Variantes para modais com glassmorphism */
export const modalOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
}
