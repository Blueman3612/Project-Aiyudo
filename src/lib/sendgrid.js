import { supabase } from './supabaseClient'

/**
 * Test the SendGrid integration
 * @param {string} toEmail - Email address to send test email to
 */
export const sendTestEmail = async (toEmail) => {
  try {
    console.log('Preparing to send test email to:', toEmail)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toEmail,
        subject: 'Aiyudo Support - Test Email',
        text: 'This is a test email from your Aiyudo Support system. If you received this, your SendGrid integration is working correctly!',
        html: `
          <h2>Aiyudo Support System Test</h2>
          <p>This is a test email from your Aiyudo Support system.</p>
          <p>If you received this, your SendGrid integration is working correctly! 🎉</p>
          <p>You can now proceed with implementing the ticket notification system.</p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    console.log('Test email sent successfully')
    return { success: true }
  } catch (error) {
    console.error('Error sending test email:', error)
    return { 
      success: false, 
      error: error.message
    }
  }
}

/**
 * Send a notification email when a new ticket is created
 * @param {Object} ticket - The ticket object
 * @param {Object} customer - The customer object
 */
export const sendTicketCreationEmail = async (ticket, customer) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customer.email,
        subject: `Ticket Created - ${ticket.title}`,
        text: `Your ticket has been created successfully.\n\nTicket Details:\nTitle: ${ticket.title}\nDescription: ${ticket.description}\n\nWe'll get back to you soon!`,
        html: `
          <h2>Your ticket has been created successfully</h2>
          <h3>Ticket Details:</h3>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Description:</strong> ${ticket.description}</p>
          <p>We'll get back to you soon!</p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    console.log('Ticket creation email sent successfully')
  } catch (error) {
    console.error('Error sending ticket creation email:', error)
  }
}

/**
 * Send a notification email when a ticket is updated
 * @param {Object} ticket - The updated ticket object
 * @param {Object} customer - The customer object
 * @param {Object} agent - The agent who updated the ticket
 */
export const sendTicketUpdateEmail = async (ticket, customer, agent) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customer.email,
        subject: `Ticket Updated - ${ticket.title}`,
        text: `Your ticket has been updated.\n\nTicket Details:\nTitle: ${ticket.title}\nStatus: ${ticket.status}\nUpdated by: ${agent.name}\n\nCheck your dashboard for more details.`,
        html: `
          <h2>Your ticket has been updated</h2>
          <h3>Ticket Details:</h3>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p><strong>Updated by:</strong> ${agent.name}</p>
          <p>Check your dashboard for more details.</p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    console.log('Ticket update email sent successfully')
  } catch (error) {
    console.error('Error sending ticket update email:', error)
  }
}

/**
 * Send a notification email when a new comment is added to a ticket
 * @param {Object} ticket - The ticket object
 * @param {Object} comment - The new comment object
 * @param {Object} customer - The customer object
 * @param {Object} author - The comment author object
 */
export const sendNewCommentEmail = async (ticket, comment, customer, author) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customer.email,
        subject: `New Comment on Ticket - ${ticket.title}`,
        text: `A new comment has been added to your ticket.\n\nTicket: ${ticket.title}\nComment by: ${author.name}\nComment: ${comment.content}\n\nCheck your dashboard for more details.`,
        html: `
          <h2>New Comment on Your Ticket</h2>
          <h3>Ticket: ${ticket.title}</h3>
          <p><strong>Comment by:</strong> ${author.name}</p>
          <p><strong>Comment:</strong> ${comment.content}</p>
          <p>Check your dashboard for more details.</p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    console.log('New comment email sent successfully')
  } catch (error) {
    console.error('Error sending new comment email:', error)
  }
}

/**
 * Send a notification email when a ticket is resolved
 * @param {Object} ticket - The resolved ticket object
 * @param {Object} customer - The customer object
 * @param {Object} agent - The agent who resolved the ticket
 */
export const sendTicketResolutionEmail = async (ticket, customer, agent) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const ticketUrl = `${window.location.origin}/customer/tickets/${ticket.id}`

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customer.email,
        subject: `Ticket Resolved - ${ticket.title}`,
        text: `Your ticket has been resolved.\n\nTicket Details:\nTitle: ${ticket.title}\nResolved by: ${agent.full_name || agent.email}\n\nWe'd love to hear your feedback! Please visit ${ticketUrl} to rate your support experience.`,
        html: `
          <h2>Your ticket has been resolved</h2>
          <h3>Ticket Details:</h3>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Resolved by:</strong> ${agent.full_name || agent.email}</p>
          <p>We'd love to hear your feedback! Please take a moment to rate your support experience.</p>
          <div style="margin: 20px 0;">
            <a href="${ticketUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Rate Your Experience
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Your feedback helps us improve our support quality and serve you better.
          </p>
        `
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send email')
    }

    console.log('Ticket resolution email sent successfully')
  } catch (error) {
    console.error('Error sending ticket resolution email:', error)
  }
} 