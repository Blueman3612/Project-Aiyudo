import { useState } from 'react'
import { sendTestEmail } from '../lib/sendgrid'

export default function EmailTest() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTestEmail = async () => {
    setLoading(true)
    setStatus('Sending test email...')
    
    try {
      const result = await sendTestEmail('nathan.hall@gauntletai.com')
      if (result.success) {
        setStatus('Test email sent successfully! Check your inbox.')
      } else {
        setStatus(`Failed to send email: ${result.error}`)
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">SendGrid Integration Test</h2>
      <button
        onClick={handleTestEmail}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Test Email'}
      </button>
      {status && (
        <p className={`mt-4 ${status.includes('Error') || status.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>
          {status}
        </p>
      )}
    </div>
  )
} 