import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useTranslation } from 'react-i18next'

export function TicketRating({ ticketId, initialRating, onRatingSubmit }) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(initialRating || 0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(!!initialRating)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('Submitting rating:', { ticketId, rating })

      const { data, error: updateError } = await supabase
        .from('tickets')
        .update({
          satisfaction_rating: rating,
          rated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .select()

      if (updateError) {
        console.error('Supabase update error:', updateError)
        throw updateError
      }

      console.log('Rating update response:', data)
      setSubmitted(true)
      if (onRatingSubmit) onRatingSubmit(rating)
    } catch (err) {
      console.error('Error submitting rating:', err.message)
      setError(t('common.tickets.ratingDetails.errors.ratingFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
        <div className="text-2xl mb-2">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={`${i < rating ? 'text-amber-400 dark:text-amber-300' : 'text-gray-300 dark:text-gray-700'}`}
            >
              ★
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('common.tickets.ratingDetails.thankYou')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {t('common.tickets.ratingDetails.satisfaction')}
      </h3>
      
      <div className="text-center">
        <div className="text-3xl mb-4">
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={i}
              className={`focus:outline-none transition-colors bg-white dark:bg-gray-800 ${
                (hoveredRating || rating) > i
                  ? 'text-amber-400 dark:text-amber-300'
                  : 'text-gray-300 dark:text-gray-700 hover:text-amber-400 dark:hover:text-amber-300'
              }`}
              onMouseEnter={() => setHoveredRating(i + 1)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(i + 1)}
            >
              ★
            </button>
          ))}
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {rating === 0 
            ? t('common.tickets.ratingDetails.clickToRate')
            : t('common.tickets.ratingDetails.youRated', { rating })}
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || rating === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('common.saving') : t('common.tickets.ratingDetails.submit')}
        </button>
      </div>
    </div>
  )
} 