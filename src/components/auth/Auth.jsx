import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { LanguageSwitcher } from '../common/LanguageSwitcher'
import { useTranslation } from 'react-i18next'

export function Auth() {
  const { t } = useTranslation()
  
  const SLIDES = [
    {
      id: 1,
      title: t('auth.slides.aiSupport.title'),
      description: t('auth.slides.aiSupport.description'),
      image: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&q=80",
    },
    {
      id: 2,
      title: t('auth.slides.realTime.title'),
      description: t('auth.slides.realTime.description'),
      image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&q=80",
    },
    {
      id: 3,
      title: t('auth.slides.analytics.title'),
      description: t('auth.slides.analytics.description'),
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80",
    },
    {
      id: 4,
      title: t('auth.slides.fileManagement.title'),
      description: t('auth.slides.fileManagement.description'),
      image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80",
    }
  ]

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    prefix: '',
    role: ''
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgSubmission, setOrgSubmission] = useState({
    name: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: ''
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

  const handleSubmitOrg = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      const { error } = await supabase
        .from('pending_organizations')
        .insert([{
          name: orgSubmission.name,
          description: orgSubmission.description,
          contact_name: orgSubmission.contactName,
          contact_email: orgSubmission.contactEmail,
          contact_phone: orgSubmission.contactPhone,
          status: 'pending'
        }])

      if (error) throw error

      // Reset form and show success modal
      setOrgSubmission({
        name: '',
        description: '',
        contactName: '',
        contactEmail: '',
        contactPhone: ''
      })
      setShowOrgForm(false)
      setShowSuccessModal(true)
    } catch (err) {
      console.error('Error submitting organization:', err)
      setError('Failed to submit organization. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcher className="bg-gray-800 text-white" />
        </div>

        {/* Left side - Auth form */}
        <div className="lg:w-[400px] flex-shrink-0 p-8 flex flex-col justify-center bg-gray-900">
          <div className="text-center mb-8 mt-8">
            <h1 className="text-7xl tracking-wider font-light">
              <span className="text-red-500">AI</span>
              <span className="text-white">YUDO</span>
            </h1>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          {signUpSuccess && (
            <div className="bg-green-900/20 border border-green-800 text-green-400 px-4 py-3 rounded relative">
              {t('auth.registrationSuccess')}
            </div>
          )}

          {!signUpSuccess && (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-gray-800"
                    placeholder={t('auth.email')}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    {t('auth.password')}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-gray-800"
                    placeholder={t('auth.password')}
                  />
                </div>

                {isSignUp && (
                  <>
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-300">
                        {t('auth.fullName')}
                      </label>
                      <input
                        id="full_name"
                        name="full_name"
                        type="text"
                        required
                        value={formData.full_name}
                        onChange={handleChange}
                        className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-gray-800"
                        placeholder={t('auth.fullName')}
                      />
                    </div>

                    <div>
                      <label htmlFor="prefix" className="block text-sm font-medium text-gray-300">
                        {t('auth.prefix')}
                      </label>
                      <select
                        id="prefix"
                        name="prefix"
                        required
                        value={formData.prefix}
                        onChange={handleChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-800 text-white"
                      >
                        <option value="">{t('auth.selectPrefix')}</option>
                        <option value="Mr.">{t('auth.prefixes.mr')}</option>
                        <option value="Ms.">{t('auth.prefixes.ms')}</option>
                        <option value="Mrs.">{t('auth.prefixes.mrs')}</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-300">
                        {t('auth.accountType')}
                      </label>
                      <select
                        id="role"
                        name="role"
                        required
                        value={formData.role}
                        onChange={handleChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-800 text-white"
                      >
                        <option value="">{t('auth.selectAccountType')}</option>
                        <option value="customer">{t('auth.roles.customer')}</option>
                        <option value="agent">{t('auth.roles.agent')}</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? t('auth.processing') : (isSignUp ? t('auth.signUp') : t('auth.signIn'))}
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
                  className="bg-transparent text-gray-300 hover:text-white text-sm font-medium border-none"
                >
                  {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShowOrgForm(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-400 bg-blue-900/30 hover:bg-blue-900/50 rounded-lg transition-colors duration-150 ease-in-out"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('auth.registerOrg')}
            </button>
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

        {/* Organization Submission Modal */}
        {showOrgForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {t('auth.organization.title')}
                </h3>
                <button
                  onClick={() => setShowOrgForm(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmitOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('auth.organization.name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={orgSubmission.name}
                    onChange={(e) => setOrgSubmission({ ...orgSubmission, name: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('auth.organization.description')}
                  </label>
                  <textarea
                    required
                    value={orgSubmission.description}
                    onChange={(e) => setOrgSubmission({ ...orgSubmission, description: e.target.value })}
                    rows={3}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('auth.organization.contactName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={orgSubmission.contactName}
                    onChange={(e) => setOrgSubmission({ ...orgSubmission, contactName: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('auth.organization.contactEmail')}
                  </label>
                  <input
                    type="email"
                    required
                    value={orgSubmission.contactEmail}
                    onChange={(e) => setOrgSubmission({ ...orgSubmission, contactEmail: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('auth.organization.contactPhone')}
                  </label>
                  <input
                    type="tel"
                    value={orgSubmission.contactPhone}
                    onChange={(e) => setOrgSubmission({ ...orgSubmission, contactPhone: e.target.value })}
                    className="block w-full pl-3 pr-10 py-2 text-sm bg-gray-800 border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white shadow-sm"
                  />
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowOrgForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600"
                  >
                    {t('auth.organization.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('auth.organization.submit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {t('auth.organization.success')}
                </h3>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="rounded-full bg-green-900/20 p-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="text-gray-300 text-center">
                  {t('auth.organization.successMessage')}
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('auth.organization.close')}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
} 