import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useTranslation } from 'react-i18next'

export function PendingOrgCount() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  const fetchPendingCount = useCallback(async () => {
    if (profile?.role !== 'admin') return

    try {
      const { count: pendingCount } = await supabase
        .from('pending_organizations')
        .select('id', { count: 'exact' })
        .eq('status', 'pending')

      setCount(pendingCount || 0)
    } catch (error) {
      console.error('Error fetching pending organizations count:', error)
    }
  }, [profile?.role])

  useEffect(() => {
    fetchPendingCount()
  }, [fetchPendingCount])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'pending_organizations',
    onInsert: fetchPendingCount,
    onUpdate: fetchPendingCount,
    onDelete: fetchPendingCount,
    enabled: profile?.role === 'admin'
  }, [fetchPendingCount, profile?.role])

  if (count === 0) return null

  return (
    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 dark:bg-red-500 rounded-full" title={t('common.organizations.pendingCount', { count })}>
      {count}
    </span>
  )
} 