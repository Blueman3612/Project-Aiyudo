import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Link } from 'react-router-dom'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useTranslation } from 'react-i18next'

export function TicketList({ session }) {
  const { t } = useTranslation()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTickets(data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
      setError(t('common.tickets.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Handle real-time updates
  const handleTicketChange = useCallback(async (newTicket) => {
    setTickets(prevTickets => {
      const ticketIndex = prevTickets.findIndex(t => t.id === newTicket.id)
      if (ticketIndex === -1) {
        // New ticket - add it to the beginning
        return [newTicket, ...prevTickets]
      } else {
        // Update existing ticket
        const updatedTickets = [...prevTickets]
        updatedTickets[ticketIndex] = newTicket
        return updatedTickets
      }
    })
  }, [])

  const handleTicketDelete = useCallback((oldTicket) => {
    setTickets(prevTickets => prevTickets.filter(t => t.id !== oldTicket.id))
  }, [])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    onInsert: handleTicketChange,
    onUpdate: handleTicketChange,
    onDelete: handleTicketDelete
  }, [handleTicketChange, handleTicketDelete])

  useEffect(() => {
    fetchTickets()

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (loading) {
    return <div>{t('common.loading')}</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('common.tickets.title')}</h2>
        <Link
          to="/tickets/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {t('common.tickets.create')}
        </Link>
      </div>

      {tickets.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">{t('common.dashboard.noTickets')}</p>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {ticket.title}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {ticket.description}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    ticket.status === 'open'
                      ? 'bg-green-100 text-green-800'
                      : ticket.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {t(`common.tickets.status.${ticket.status}`)}
                  </span>
                  <span className="mt-2 text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
} 