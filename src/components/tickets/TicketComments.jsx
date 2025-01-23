import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'

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
  const [typingUsers, setTypingUsers] = useState(new Set())
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [comments, typingUsers]) // Scroll when comments or typing status changes

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // First fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      // Then fetch all relevant users in one go
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))]
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      if (usersError) throw usersError

      // Combine the data
      const comments = commentsData.map(comment => ({
        ...comment,
        user: usersData.find(user => user.id === comment.user_id)
      }))

      // Filter internal notes if not agent/admin
      const filteredComments = profile?.role === 'agent' || profile?.role === 'admin'
        ? comments
        : comments.filter(comment => !comment.is_internal)

      setComments(filteredComments)
    } catch (error) {
      console.error('Error in fetchComments:', error)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [ticketId, profile?.role])

  // Initial fetch
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const onInsertComment = useCallback(async (payload) => {
    try {
      // Fetch the user data for the new comment
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', payload.user_id)
        .single()

      if (userError) throw userError

      const newComment = {
        ...payload,
        user: userData
      }

      // Only add the comment if it matches the filter criteria
      if (profile?.role === 'agent' || profile?.role === 'admin' || !newComment.is_internal) {
        setComments(prevComments => [...prevComments, newComment])
      }
    } catch (error) {
      console.error('Error processing new comment:', error)
    }
  }, [profile?.role])

  // Add typing indicator functions
  const updateTypingStatus = useCallback(async (isTyping) => {
    try {
      const { error } = await supabase
        .from('typing_status')
        .upsert({
          ticket_id: ticketId,
          user_id: user.id,
          is_typing: isTyping,
          updated_at: new Date().toISOString()
        })
      if (error) throw error
    } catch (error) {
      console.error('Error updating typing status:', error)
    }
  }, [ticketId, user.id])

  const handleTyping = () => {
    updateTypingStatus(true)
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false)
    }, 2000)
  }

  // Handle typing status changes
  const onTypingStatusChange = useCallback((newStatus, oldStatus) => {
    setTypingUsers(prev => {
      const newSet = new Set(prev)
      if (newStatus.is_typing) {
        newSet.add(newStatus.user_id)
      } else {
        newSet.delete(newStatus.user_id)
      }
      return newSet
    })
  }, [])

  // Clean up typing status on unmount
  useEffect(() => {
    return () => {
      updateTypingStatus(false)
    }
  }, [updateTypingStatus])

  // Set up realtime subscriptions using the centralized hook
  useRealtimeSubscription({
    table: 'ticket_comments',
    filter: `ticket_id=eq.${ticketId}`,
    onInsert: onInsertComment
  }, [ticketId, onInsertComment])

  useRealtimeSubscription({
    table: 'typing_status',
    filter: `ticket_id=eq.${ticketId}`,
    onUpdate: onTypingStatusChange,
    onInsert: onTypingStatusChange
  }, [ticketId, onTypingStatusChange])

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
          is_internal: isInternal && (profile?.role === 'agent' || profile?.role === 'admin')
        })

      if (insertError) throw insertError

      setNewComment('')
      setIsInternal(false)
    } catch (error) {
      console.error('Error creating comment:', error)
      setError('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
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
    <div className="min-w-0 flex flex-col h-[calc(100vh-24rem)] max-h-[800px] max-w-3xl bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Chat</h2>
      </div>
      
      {/* Chat messages container with scrolling */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-800/50">
        <div className="py-4 px-4">
          {comments.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No messages yet. Start the conversation!
            </p>
          ) : (
            <div className="space-y-4 min-w-0">
              {comments.map((comment, index) => {
                const isCurrentUser = comment.user_id === user.id;
                const showFullHeader = index === 0 || 
                  comments[index - 1].user_id !== comment.user_id ||
                  new Date(comment.created_at) - new Date(comments[index - 1].created_at) > 300000;

                return (
                  <div key={comment.id} className={`min-w-0 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] space-y-1">
                      {showFullHeader && (
                        <div className={`flex flex-wrap items-baseline gap-2 mb-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <span className="font-semibold text-sm text-blue-600 dark:text-blue-400 truncate">
                            {isCurrentUser ? 'You' : (comment.user?.full_name || comment.user?.email)}
                          </span>
                        </div>
                      )}
                      <div className={`group flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                        <div className={`inline-block px-3 py-2 rounded-lg ${
                          comment.is_internal
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50'
                            : isCurrentUser
                              ? 'bg-blue-500 text-white dark:bg-blue-600'
                              : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <p className={`text-sm whitespace-pre-wrap break-words ${
                            comment.is_internal
                              ? 'text-gray-900 dark:text-gray-100'
                              : isCurrentUser
                                ? 'text-white'
                                : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {comment.content}
                          </p>
                        </div>
                        <div className={`text-xs mt-1 ${
                          isCurrentUser
                            ? 'text-gray-400 dark:text-gray-500'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {formatTimestamp(comment.created_at)}
                          {comment.is_internal && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                              Internal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Typing indicators */}
              {typingUsers.size > 0 && (
                <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm">
                    {Array.from(typingUsers).map(userId => {
                      const typingUser = comments.find(c => c.user_id === userId)?.user
                      return typingUser?.full_name || typingUser?.email || 'Someone'
                    }).join(', ')} is typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Comment input form - fixed at bottom */}
      <div className="min-w-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 rounded-b-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-4 min-w-0">
            <textarea
              id="comment"
              rows={2}
              className="flex-1 min-h-[80px] rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white pl-3 pr-10 py-2 text-sm transition-colors"
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyPress}
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

          {(profile?.role === 'agent' || profile?.role === 'admin') && (
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
            <div className="p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  )
} 