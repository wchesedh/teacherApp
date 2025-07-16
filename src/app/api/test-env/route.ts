import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  return NextResponse.json({
    hasServiceRoleKey: !!serviceRoleKey,
    keyLength: serviceRoleKey ? serviceRoleKey.length : 0,
    keyPrefix: serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'none'
  })
} 