import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Temporary: Use hardcoded service role key for testing
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcmhnYmR4aGd3bHV0c2h5cXpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjYzMDgxMCwiZXhwIjoyMDY4MjA2ODEwfQ.VsCjHX1j-mfqqI9u_x4RGw8Q-lpEtUWG9OS35p-HvQY'

const supabaseAdmin = createClient(
  'https://werhgbdxhgwlutshyqzq.supabase.co',
  serviceRoleKey
)

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    // Check if parent already exists in database
    const { data: existingParent, error: checkError } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('email', email.trim())
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing parent:', checkError)
      return NextResponse.json(
        { error: 'Error checking existing parent' },
        { status: 500 }
      )
    }

    if (existingParent) {
      return NextResponse.json(
        { error: 'A parent with this email already exists in the system.' },
        { status: 409 }
      )
    }

    // Create the auth user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        role: 'parent'
      },
      email_confirm: true // Auto-confirm the email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      
      // Handle specific error cases
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'A user with this email address has already been registered. Please use a different email or contact the administrator.' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No user data returned' },
        { status: 500 }
      )
    }

    // Create the parent record in the database
    const { data: parentData, error: dbError } = await supabaseAdmin
      .from('parents')
      .insert([{
        id: authData.user.id,
        name,
        email,
        password // Store for teacher reference
      }])
      .select()
      .single()

    if (dbError) {
      console.error('Error creating parent record:', dbError)
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      parent: parentData
    })

  } catch (error) {
    console.error('Error in create-parent API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 