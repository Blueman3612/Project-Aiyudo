import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const SLIDES = [
  {
    id: 1,
    title: "AI-Powered Support",
    description: "Intelligent ticket routing and automated responses to enhance customer service efficiency",
    image: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&q=80",
  },
  {
    id: 2,
    title: "Real-Time Communication",
    description: "Live chat and instant notifications keep your team and customers connected",
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&q=80",
  },
  {
    id: 3,
    title: "Smart Analytics",
    description: "Data-driven insights to optimize your customer support performance",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80",
  },
  {
    id: 4,
    title: "File Management",
    description: "Secure document sharing and organization for seamless collaboration",
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80",
  }
]

export function Auth() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    prefix: '',
    role: ''
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check if profile exists
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          // If no profile exists, create one from metadata
          if (!profile && session.user.user_metadata) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata.full_name,
                prefix: session.user.user_metadata.prefix,
                role: session.user.user_metadata.role
              }])

            if (profileError) {
              console.error('Error creating profile:', profileError)
            }
          }
        } catch (error) {
          console.error('Profile check error:', error)
        }
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Auto-advance slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(timer)
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSignUpSuccess(false)

    try {
      if (isSignUp) {
        // Validate required fields
        if (!formData.full_name.trim()) {
          throw new Error('Full Name is required')
        }
        if (!formData.prefix) {
          throw new Error('Prefix is required')
        }
        if (!formData.role) {
          throw new Error('Account type is required')
        }

        // Sign up with metadata
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              prefix: formData.prefix,
              role: formData.role
            }
          }
        })

        if (signUpError) {
          console.error('Signup error:', signUpError)
          throw signUpError
        }

        setSignUpSuccess(true)
        setFormData({
          email: '',
          password: '',
          full_name: '',
          prefix: '',
          role: ''
        })
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        })

        if (signInError) throw signInError
      }
    } catch (err) {
      console.error('Final error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-screen h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Left side - Sign in form */}
      <div className="w-[400px] flex-shrink-0 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 shadow-lg z-10">
        <div className="w-full space-y-8">
          <div>
            <div className="text-center mb-8">
              <div className="font-light text-7xl text-gray-800 dark:text-white tracking-wider">
                <span className="text-red-600 dark:text-red-500">AI</span>YUDO
              </div>
            </div>
            <h2 className="text-center text-2xl font-extrabold text-gray-900 dark:text-white">
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </h2>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          {signUpSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
              Registration successful! Please check your email to confirm your account.
            </div>
          )}

          {!signUpSuccess && (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                    placeholder="Email address"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                    placeholder="Password"
                  />
                </div>

                {isSignUp && (
                  <>
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name
                      </label>
                      <input
                        id="full_name"
                        name="full_name"
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={handleChange}
                        className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                        placeholder="Full Name"
                      />
                    </div>

                    <div>
                      <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Prefix
                      </label>
                      <select
                        id="prefix"
                        name="prefix"
                        required
                        value={formData.prefix}
                        onChange={handleChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select a prefix</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Mrs.">Mrs.</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Account Type
                      </label>
                      <select
                        id="role"
                        name="role"
                        required
                        value={formData.role}
                        onChange={handleChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select account type</option>
                        <option value="customer">Customer</option>
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (isSignUp ? 'Sign up' : 'Sign in')}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setSignUpSuccess(false)
                    setFormData({
                      email: '',
                      password: '',
                      full_name: '',
                      prefix: '',
                      role: ''
                    })
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right side - Slideshow */}
      <div className="flex-grow relative overflow-hidden">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
            
            {/* Background image */}
            <img
              src={slide.image}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 px-12">
              <h3 className="text-4xl font-bold mb-4">{slide.title}</h3>
              <p className="text-xl text-center max-w-lg">{slide.description}</p>
            </div>
          </div>
        ))}

        {/* Slide indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-30">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-white w-8' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
} 