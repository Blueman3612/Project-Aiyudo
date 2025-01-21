import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTicketSubscription(userId, onTicketUpdate) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    // Only create a new subscription if we don't have one
    if (!channelRef.current) {
      console.log('Setting up persistent ticket subscription')
      
      const channel = supabase.channel('tickets-global', {
        config: {
          broadcast: { self: true },
          presence: { key: userId }
        }
      })

      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tickets'
        }, (payload) => {
          console.log('Received ticket update:', payload)
          onTicketUpdate(payload)
        })
        .subscribe((status) => {
          console.log('Subscription status:', status)
          if (status === 'SUBSCRIBED') {
            channelRef.current = channel
          }
        })

      // Cleanup function
      return () => {
        if (channelRef.current) {
          console.log('Cleaning up persistent ticket subscription')
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
      }
    }
  }, [userId, onTicketUpdate])
} 