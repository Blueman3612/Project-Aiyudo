import { supabase } from './supabaseClient'

export async function fetchTickets(status = 'active') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  try {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        customer:profiles!customer_id(*),
        agent:profiles!agent_id(*),
        team:teams(*)
      `)
      .order('created_at', { ascending: false })

    if (status === 'active') {
      query = query.in('status', ['open', 'in_progress'])
    } else if (status === 'resolved') {
      query = query.eq('status', 'resolved')
    }

    // If not admin, only show tickets where user is either:
    // 1. The assigned agent
    // 2. Member of the assigned team
    if (profile?.role !== 'admin') {
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)

      const teamIds = userTeams?.map(t => t.team_id) || []
      
      query = query.or(`agent_id.eq.${user.id},team_id.in.(${teamIds.join(',')})`)
    }

    const { data, error } = await query
    if (error) throw error

    return data || []
  } catch (err) {
    console.error('Error fetching tickets:', err)
    throw err
  }
}

export async function assignTicketToTeam(ticketId, teamId) {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        team_id: teamId,
        agent_id: null, // Remove individual agent assignment
        status: teamId ? 'in_progress' : 'open'
      })
      .eq('id', ticketId)

    if (error) throw error
  } catch (err) {
    console.error('Error assigning ticket to team:', err)
    throw err
  }
}

export async function assignTicketToAgent(ticketId, agentId) {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        agent_id: agentId,
        team_id: null, // Remove team assignment
        status: agentId ? 'in_progress' : 'open'
      })
      .eq('id', ticketId)

    if (error) throw error
  } catch (err) {
    console.error('Error assigning ticket to agent:', err)
    throw err
  }
}

export async function updateTicketStatus(ticketId, status) {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId)

    if (error) throw error
  } catch (err) {
    console.error('Error updating ticket status:', err)
    throw err
  }
}

export async function createTicket(data) {
  try {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([{
        ...data,
        status: data.agent_id || data.team_id ? 'in_progress' : 'open'
      }])
      .select()
      .single()

    if (error) throw error
    return ticket
  } catch (err) {
    console.error('Error creating ticket:', err)
    throw err
  }
} 