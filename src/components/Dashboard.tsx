'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navigation from './Navigation'
import AdminDashboard from './admin/AdminDashboard'
import TeacherDashboard from './teacher/TeacherDashboard'
import ParentDashboard from './parent/ParentDashboard'

export default function Dashboard() {
  const { user } = useAuth()

  // If user is admin, show admin dashboard
  if (user?.role === 'admin') {
    return <AdminDashboard />
  }

  // If user is teacher, show teacher dashboard
  if (user?.role === 'teacher') {
    return <TeacherDashboard />
  }

  // If user is parent, show parent dashboard
  if (user?.role === 'parent') {
    return <ParentDashboard />
  }

  const getRoleBasedContent = () => {
    switch (user?.role) {
      default:
        return {
                  title: 'Dashboard',
        description: 'Welcome to TrackWise - Smart student progress tracking',
          features: []
        }
    }
  }

  const content = getRoleBasedContent()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {content.title}
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.name}!
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Your Role</CardTitle>
                <CardDescription>
                  {user?.role ? (user.role as string).charAt(0).toUpperCase() + (user.role as string).slice(1) : 'Unknown'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  {content.description}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks for your role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {content.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Info</CardTitle>
                <CardDescription>
                  Your account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span> {user?.name}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {user?.email}
                  </div>
                  <div>
                    <span className="font-medium">Role:</span> {user?.role || 'Unknown'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 