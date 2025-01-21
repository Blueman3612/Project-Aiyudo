import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

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

    const initialize = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Initial session:', session ? 'exists' : 'none')

        if (!mounted) return

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) {
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
          setUser(null)
          setProfile(null)
          return
        }

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) {
            setUser(session.user)
            setProfile(profile)
          } else if (mounted) {
            // Create profile if it doesn't exist
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  email: session.user.email,
                  role: 'customer'
                }
              ])
              .single()

            if (!createError && newProfile) {
              setUser(session.user)
              setProfile(newProfile)
            } else {
              // If profile creation fails, sign out
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
            }
          }
        }
      } catch (error) {
        console.error('Auth change error:', error)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [initialized])

  const value = {
    user,
    profile,
    loading,
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

        // Create profile for new user
        if (response.data?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: response.data.user.id,
                email: response.data.user.email,
                role: 'customer',
                full_name: data.options?.data?.full_name
              }
            ])

          if (profileError) {
            console.error('Error creating profile:', profileError)
          }
        }

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
        window.location.href = '/auth'
      } catch (error) {
        console.error('Error signing out:', error)
        throw error
      }
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
} 