import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'

function formatTimestamp(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  
  // Check if the date is today
  if (date.toDateString() === now.toDateString()) {
    return time
  }
  
  // If not today, include the date
  return `${time} • ${date.toLocaleDateString()}`
}

export function TicketComments({ ticketId }) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    console.log('Fetching comments for ticket:', ticketId)
    fetchComments()
  }, [ticketId])

  const fetchComments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get comments first
      const { data: comments, error: commentsError } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (commentsError) {
        console.error('Error fetching comments:', commentsError)
        throw commentsError
      }

      // Filter out internal notes if not an agent
      const filteredComments = profile?.role === 'agent' 
        ? comments 
        : comments?.filter(comment => !comment.is_internal)

      if (!filteredComments?.length) {
        setComments([])
        return
      }

      // Get unique user IDs
      const userIds = [...new Set(filteredComments.map(comment => comment.user_id))]
      console.log('Fetching profiles for user IDs:', userIds)

      // Fetch profiles using RLS policy
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, organization')
        .or(userIds.map(id => `id.eq.${id}`).join(','))

      if (profileError) {
        console.error('Error fetching profiles:', profileError)
      }

      console.log('Raw profiles response:', profiles)

      // Create a map for quick profile lookups
      const profileMap = {}
      if (profiles) {
        profiles.forEach(profile => {
          profileMap[profile.id] = profile
        })
      }

      // Map profiles to comments with detailed logging
      const enrichedComments = filteredComments.map(comment => {
        const userProfile = profileMap[comment.user_id]
        console.log('Processing comment:', {
          commentId: comment.id,
          userId: comment.user_id,
          foundProfile: userProfile ? 'yes' : 'no',
          profileDetails: userProfile
        })
        return {
          ...comment,
          user: userProfile || { 
            id: comment.user_id,
            full_name: 'Deleted User',
            email: 'deleted@user.com'
          }
        }
      })

      setComments(enrichedComments)
    } catch (error) {
      console.error('Error in fetchComments:', error)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      setError(null)

      const { error: insertError } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: newComment.trim(),
          is_internal: isInternal && profile?.role === 'agent'
        })

      if (insertError) throw insertError

      setNewComment('')
      setIsInternal(false)
      await fetchComments()
    } catch (error) {
      console.error('Error creating comment:', error)
      setError('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
        Loading comments...
      </div>
    )
  }

  return (
    <div className="min-w-0 flex flex-col h-[calc(100vh-24rem)] max-h-[800px]">
      {/* Chat messages container with scrolling */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="py-4 px-4">
          {comments.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            <div className="space-y-2 min-w-0">
              {comments.map((comment, index) => {
                const isFirstInGroup = index === 0 || 
                  comments[index - 1].user_id !== comment.user_id ||
                  new Date(comment.created_at) - new Date(comments[index - 1].created_at) > 300000;

                return (
                  <div key={comment.id} className="min-w-0">
                    {isFirstInGroup && (
                      <div className="flex flex-wrap items-baseline gap-2 mt-6 first:mt-0">
                        <span className="font-semibold text-base text-blue-600 dark:text-blue-400 truncate">
                          {comment.user_id === user.id ? 'You' : (comment.user?.full_name || comment.user?.email)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {formatTimestamp(comment.created_at)}
                        </span>
                        {comment.is_internal && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 shrink-0">
                            Internal
                          </span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 mt-1">
                      <div className={`inline-block max-w-[85%] px-3 py-1.5 rounded ${
                        comment.is_internal
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50'
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                        {!isFirstInGroup && (
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {formatTimestamp(comment.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Comment input form - fixed at bottom */}
      <div className="min-w-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-4 min-w-0">
            <textarea
              id="comment"
              rows={2}
              className="flex-1 min-h-[80px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm transition-colors"
              placeholder="Type your message..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="shrink-0 inline-flex items-center px-4 py-2 h-10 rounded-lg text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              {submitting ? 'Sending...' : 'Send'}
            </button>
          </div>

          {profile?.role === 'agent' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="internal"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                disabled={submitting}
              />
              <label
                htmlFor="internal"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                Internal note
              </label>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}
        </form>
      </div>
    </div>
  )
} 