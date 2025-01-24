import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [typingUsers, setTypingUsers] = useState(new Set())
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

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

      // First fetch comments with attachments
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          attachments:ticket_attachments(*)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      // Then fetch all relevant users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', [...new Set(commentsData.map(comment => comment.user_id))])

      if (usersError) throw usersError

      // Combine the data
      const comments = commentsData.map(comment => ({
        ...comment,
        user: usersData.find(user => user.id === comment.user_id),
        attachments: comment.attachments || []
      }))

      // Filter internal notes if not agent/admin
      const filteredComments = profile?.role === 'agent' || profile?.role === 'admin'
        ? comments
        : comments.filter(comment => !comment.is_internal)

      setComments(filteredComments)
    } catch (error) {
      console.error('Error in fetchComments:', error)
      setError(t('common.tickets.comments.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [ticketId, profile?.role, t])

  // Initial fetch
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const onInsertComment = useCallback(async (payload) => {
    try {
      // Fetch the user data and attachments for the new comment
      const [userResponse, attachmentsResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.user_id)
          .single(),
        supabase
          .from('ticket_attachments')
          .select('*')
          .eq('comment_id', payload.id)
      ])

      if (userResponse.error) throw userResponse.error
      if (attachmentsResponse.error) throw attachmentsResponse.error

      const newComment = {
        ...payload,
        user: userResponse.data,
        attachments: attachmentsResponse.data || []
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

  const handleFileSelect = async (files) => {
    if (!files.length) return;
    
    try {
      setUploading(true);
      setError(null);

      const newPendingAttachments = [];
      for (const file of files) {
        // Generate a unique file path
        const filePath = `tickets/${ticketId}/${Date.now()}-${file.name}`;
        
        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newPendingAttachments.push({
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          storage_path: filePath
        });
      }

      setPendingAttachments(prev => [...prev, ...newPendingAttachments]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setError(t('common.tickets.comments.errors.uploadFailed'));
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadFile = async (path, fileName) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError(t('common.tickets.comments.errors.downloadFailed'));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const messageContent = newComment.trim();
    if (!messageContent && !pendingAttachments.length) return;

    try {
      setSubmitting(true);
      setError(null);

      // Create the comment
      const { data: commentData, error: commentError } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: messageContent,
          is_internal: isInternal && (profile?.role === 'agent' || profile?.role === 'admin')
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // If there are pending attachments, create attachment records
      if (pendingAttachments.length > 0) {
        const { error: attachmentError } = await supabase
          .from('ticket_attachments')
          .insert(
            pendingAttachments.map(attachment => ({
              ...attachment,
              ticket_id: ticketId,
              comment_id: commentData.id,
              uploaded_by: user.id
            }))
          );

        if (attachmentError) throw attachmentError;
      }

      setNewComment('');
      setPendingAttachments([]);
      setIsInternal(false);
    } catch (error) {
      console.error('Error creating comment:', error);
      setError(t('common.tickets.comments.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const removePendingAttachment = (index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

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
        <span>{t('common.loading')}</span>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex flex-col h-[calc(100vh-12rem)] max-h-[1000px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('common.tickets.comments.title')}
        </h2>
      </div>
      
      {/* Chat messages container with scrolling */}
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="py-4 px-4">
          {comments.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {t('common.tickets.comments.noMessages')}
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
                            {isCurrentUser ? t('common.tickets.comments.you') : (comment.user?.full_name || comment.user?.email || t('common.tickets.comments.unknownUser'))}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTimestamp(comment.created_at)}
                            {comment.is_internal && (
                              <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                                {t('common.tickets.comments.internal')}
                              </span>
                            )}
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
                          {comment.attachments?.length > 0 && (
                            <div className={`${comment.content ? 'mt-2' : '-m-1'} space-y-2`}>
                              {comment.attachments.map((attachment) => {
                                const isImage = attachment.file_type?.toLowerCase().startsWith('image/');
                                const { data: { publicUrl } } = supabase.storage
                                  .from('attachments')
                                  .getPublicUrl(attachment.storage_path);

                                if (isImage) {
                                  return (
                                    <div key={attachment.id} className="relative group inline-block">
                                      <img
                                        src={publicUrl}
                                        alt={attachment.file_name}
                                        className="max-w-full w-auto max-h-64 rounded-lg object-contain cursor-pointer"
                                        onClick={() => window.open(publicUrl, '_blank')}
                                        onError={(e) => {
                                          console.error('Image failed to load:', publicUrl);
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadFile(attachment.storage_path, attachment.file_name);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={t('common.tickets.comments.download')}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    key={attachment.id}
                                    onClick={() => downloadFile(attachment.storage_path, attachment.file_name)}
                                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${
                                      isCurrentUser
                                        ? 'text-blue-100 hover:text-white'
                                        : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                                    } transition-colors`}
                                    title={t('common.tickets.comments.download')}
                                  >
                                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="truncate">{attachment.file_name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {!showFullHeader && comment.is_internal && (
                          <div className="text-xs mt-1">
                            <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                              {t('common.tickets.comments.internal')}
                            </span>
                          </div>
                        )}
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
                    {t('common.tickets.comments.typing', { count: typingUsers.size })}
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
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700"
                >
                  <span className="text-sm truncate max-w-[200px]">{attachment.file_name}</span>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(index)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title={t('common.remove')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative flex items-start min-w-0">
            <textarea
              id="comment"
              rows={3}
              className="flex-1 h-[60px] resize-none rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white pl-3 pr-20 py-3 text-sm transition-colors"
              placeholder={t('common.tickets.comments.placeholder')}
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyPress}
              disabled={submitting || uploading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
              <label className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  disabled={uploading}
                />
                {uploading ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </label>
              <button
                type="submit"
                disabled={submitting || uploading || (!newComment.trim() && !pendingAttachments.length)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={t('common.tickets.comments.send')}
              >
                {submitting ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {(profile?.role === 'agent' || profile?.role === 'admin') && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="internal"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                disabled={submitting || uploading}
              />
              <label
                htmlFor="internal"
                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {t('common.tickets.comments.internalNote')}
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