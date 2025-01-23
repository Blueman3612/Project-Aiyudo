import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useRealtimeSubscription({
  schema = 'public',
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true
}, deps = []) {
  const channelRef = useRef(null)
  const isInitializedRef = useRef(false)

  const handleChange = useCallback(async (payload) => {
    console.log(`Realtime ${payload.eventType} for ${table}:`, payload)

    try {
      switch (payload.eventType) {
        case 'INSERT':
          onInsert && await onInsert(payload.new)
          break
        case 'UPDATE':
          onUpdate && await onUpdate(payload.new, payload.old)
          break
        case 'DELETE':
          onDelete && await onDelete(payload.old)
          break
        default:
          console.log('Unhandled event type:', payload.eventType)
      }
    } catch (error) {
      console.error('Error handling realtime change:', error)
    }
  }, [table, onInsert, onUpdate, onDelete])

  useEffect(() => {
    // Don't create a subscription if disabled or no table specified
    if (!enabled || !table || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    const channelId = `${table}_${filter ? filter.replace(/[^a-zA-Z0-9]/g, '_') : 'all'}`
    
    console.log(`Setting up realtime subscription for ${table}:`, {
      schema,
      table,
      filter,
      channelId
    })
    
    try {
      // Create channel with reconnection enabled
      const channel = supabase.channel(channelId, {
        config: {
          broadcast: { ack: true },
          presence: {
            key: channelId,
          },
        }
      })

      // Set up the subscription
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema,
            table,
            ...(filter ? { filter } : {})
          },
          (payload) => {
            console.log(`Received realtime event for ${table}:`, payload)
            handleChange(payload)
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status for ${channelId}:`, status, {
            config: channel.config,
            topic: channel.topic,
            state: channel.state,
          })
        })

      channelRef.current = channel

    } catch (error) {
      console.error('Error setting up subscription:', error)
    }

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up subscription for', channelId)
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      isInitializedRef.current = false
    }
  }, [table, filter, handleChange, schema, enabled, ...deps])
} 