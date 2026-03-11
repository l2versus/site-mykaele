'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '@/stores/toast-store'

export function CrmToasts() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => {
          const colors = {
            success: { bg: '#0a140a', border: '#2ECC8A33', text: '#2ECC8A', icon: '✓' },
            error: { bg: '#1a0a08', border: '#FF6B4A33', text: '#FF6B4A', icon: '✕' },
            info: { bg: '#0a0a14', border: '#4A7BFF33', text: '#4A7BFF', icon: 'ℹ' },
          }[toast.type]

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              onClick={() => removeToast(toast.id)}
            >
              <span className="text-base leading-none">{colors.icon}</span>
              {toast.message}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
