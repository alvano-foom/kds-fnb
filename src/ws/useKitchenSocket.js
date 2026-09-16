import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KitchenSocket } from './kitchenSocket'
import { useAuthStore } from '../store/authStore'
import { orderLinesQueryKey } from '../hooks/useOrderLines'

/**
 * Opens one socket per companyId scope via a ref so it survives re-renders
 * untouched (advanced-event-handler-refs), feeds order-line events straight
 * into the react-query cache that BoardPage reads from, and exposes a
 * connection status the UI/polling fallback can react to.
 */
export function useKitchenSocket(companyId) {
  const queryClient = useQueryClient()
  const socketRef = useRef(null)
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    if (!companyId) return undefined
    const key = orderLinesQueryKey(companyId)

    const socket = new KitchenSocket({
      companyId,
      getToken: () => useAuthStore.getState().accessToken,
      onStatusChange: setStatus,
      onEvent: (message) => {
        if (message.type === 'order_line.created' || message.type === 'order_line.updated') {
          queryClient.setQueryData(key, (cards = []) => {
            const exists = cards.some((c) => c.id === message.data.id)
            return exists
              ? cards.map((c) => (c.id === message.data.id ? message.data : c))
              : [...cards, message.data]
          })
        } else if (message.type === 'order_line.removed') {
          queryClient.setQueryData(key, (cards = []) => cards.filter((c) => c.id !== message.data.id))
        }
      },
    })

    socketRef.current = socket
    socket.connect()
    return () => socket.close()
  }, [companyId, queryClient])

  return { status }
}
