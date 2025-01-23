import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const ticketListenersRef = useRef(new Set())

  // Helper function to check if user is admin
  const isAdmin = () => profile?.role === 'admin'

  // Add/remove ticket update listeners (kept for backward compatibility)
  const addTicketListener = useCallback((listener) => {
    ticketListenersRef.current.add(listener)
    return () => ticketListenersRef.current.delete(listener)
  }, [])

  // Handle ticket updates
  const handleTicketUpdate = useCallback((payload) => {
    console.log('Received ticket update:', payload)
    // Notify all listeners
    ticketListenersRef.current.forEach(listener => listener(payload))
  }, [])

  // Set up real-time subscription using our hook
  useRealtimeSubscription({
    table: 'tickets',
    onInsert: handleTicketUpdate,
    onUpdate: handleTicketUpdate,
    onDelete: handleTicketUpdate,
    enabled: !!user?.id // Only enable subscription when user is logged in
  }, [handleTicketUpdate, user?.id])

  // Fetch user profile data
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      // Set default role to 'customer' if not set
      if (!data.role) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'customer' })
          .eq('id', userId)

        if (!updateError) {
          data.role = 'customer'
        }
      }

      return data
    } catch (error) {
      console.error('Error:', error)
      return null
    }
  }

  // Initialize auth state
  useEffect(() => {
    let mounted = true
    let lastKnownUserId = null

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Initial session:', session ? 'exists' : 'none')

        if (!mounted) return

        if (session?.user) {
          // Skip if we already have this user's session
          if (lastKnownUserId === session.user.id) {
            console.log('Skipping duplicate session initialization')
            return
          }

          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) {
            lastKnownUserId = session.user.id
            setUser(session.user)
            setProfile(profile)
          }
        }
      } catch (error) {
        console.error('Initialization error:', error)
      } finally {
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initialize()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (!mounted || !initialized) return

      try {
        if (event === 'SIGNED_OUT' || !session) {
          lastKnownUserId = null
          setUser(null)
          setProfile(null)
          ticketListenersRef.current.clear()
          return
        }

        if (session?.user) {
          // Skip if we already have this user's session
          if (lastKnownUserId === session.user.id) {
            console.log('Skipping duplicate auth state change')
            return
          }

          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) {
            lastKnownUserId = session.user.id
            setUser(session.user)
            setProfile(profile)
          }
        }
      } catch (error) {
        console.error('Auth change error:', error)
        if (mounted) {
          lastKnownUserId = null
          setUser(null)
          setProfile(null)
          ticketListenersRef.current.clear()
        }
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
      ticketListenersRef.current.clear()
    }
  }, [initialized])

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    addTicketListener,
    signIn: async (data) => {
      try {
        const response = await supabase.auth.signInWithPassword(data)
        if (response.error) throw response.error
        return response
      } catch (error) {
        console.error('Error signing in:', error)
        throw error
      }
    },
    signUp: async (data) => {
      try {
        const response = await supabase.auth.signUp(data)
        if (response.error) throw response.error
        return response
      } catch (error) {
        console.error('Error signing up:', error)
        throw error
      }
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        ticketListenersRef.current.clear()
        window.location.href = '/auth'
      } catch (error) {
        console.error('Error signing out:', error)
        throw error
      }
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
} 