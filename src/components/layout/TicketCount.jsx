import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'

export function TicketCount() {
  const { user, profile } = useAuth()
  const [count, setCount] = useState(0)

  const fetchTicketCount = useCallback(async () => {
    if (!user?.id || (profile?.role !== 'agent' && profile?.role !== 'admin')) return

    try {
      let query = supabase
        .from('tickets')
        .select('id', { count: 'exact' })
        .in('status', ['open', 'in_progress'])

      // If not admin, only show tickets assigned to the agent
      if (profile?.role !== 'admin') {
        query = query.eq('agent_id', user.id)
      }

      const { count: ticketCount } = await query
      setCount(ticketCount || 0)
    } catch (error) {
      console.error('Error fetching ticket count:', error)
    }
  }, [user?.id, profile?.role])

  useEffect(() => {
    fetchTicketCount()
  }, [fetchTicketCount])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    filter: profile?.role === 'admin' ? undefined : `agent_id=eq.${user?.id}`,
    onInsert: fetchTicketCount,
    onUpdate: fetchTicketCount,
    onDelete: fetchTicketCount
  }, [fetchTicketCount, user?.id, profile?.role])

  if (count === 0) return null

  return (
    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 dark:bg-red-500 rounded-full">
      {count}
    </span>
  )
} 