'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugAuth() {
  const { user, loading } = useAuth()

  return (
    <Card className="w-full max-w-md mx-auto mb-4">
      <CardHeader>
        <CardTitle>Debug: Authentication State</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Loading:</span> {loading ? 'true' : 'false'}
          </div>
          <div>
            <span className="font-medium">User:</span> {user ? 'Logged in' : 'Not logged in'}
          </div>
          {user && (
            <>
              <div>
                <span className="font-medium">User ID:</span> {user.id}
              </div>
              <div>
                <span className="font-medium">Email:</span> {user.email}
              </div>
              <div>
                <span className="font-medium">Name:</span> {user.name}
              </div>
              <div>
                <span className="font-medium">Role:</span> {user.role}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 