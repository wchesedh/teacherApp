'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { useRouter } from 'next/navigation'

interface Stats {
  teachers: number
  posts: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    teachers: 0,
    posts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      // Fetch teachers count from teachers table
      const { count: teachersCount, error: teachersError } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true })

      // Fetch posts count
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })

      setStats({
        teachers: teachersCount || 0,
        posts: postsCount || 0
      })

      // Log any errors for debugging
      if (teachersError) console.error('Error fetching teachers:', teachersError)
      if (postsError) console.error('Error fetching posts:', postsError)

    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statsData = [
    {
      title: 'Total Teachers',
      value: stats.teachers.toString(),
      icon: Users,
      description: 'Active teachers in the system'
    },
    {
      title: 'Total Posts',
      value: stats.posts.toString(),
      icon: MessageSquare,
      description: 'Teacher posts this month'
    }
  ]

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage teachers, classes, students, and system settings
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {statsData.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>



        {/* Management Sections */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Management</CardTitle>
              <CardDescription>
                Manage all teachers in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push('/admin/teachers')}
                className="flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>View All Teachers</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
} 