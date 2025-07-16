'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  BookOpen, 
  MessageSquare, 
  User, 
  Calendar,
  Users,
  Mail
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { toast } from 'sonner'

interface Student {
  id: string
  name: string
  class_id: string | null
  created_at: string
  class?: Class
}

interface Class {
  id: string
  name: string
  teacher_id: string
  teacher?: Teacher
}

interface Teacher {
  id: string
  name: string
  email: string
}

interface Post {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
}

export default function ParentDashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    children: 0,
    classes: 0,
    posts: 0
  })

  useEffect(() => {
    if (user) {
      fetchParentData()
    }
  }, [user])

  const fetchParentData = async () => {
    try {
      setLoading(true)
      console.log('Fetching parent data for:', user?.email)

      // First, find the parent record by auth user ID
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (parentError) {
        console.error('Error fetching parent:', parentError)
        toast.error('Error loading parent data')
        return
      }

      if (!parentData) {
        console.log('No parent record found for user ID:', user?.id)
        setStudents([])
        setPosts([])
        setStats({ children: 0, classes: 0, posts: 0 })
        return
      }

      // Get students linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select(`
          student_id,
          students (
            id,
            name,
            class_id,
            created_at,
            classes (
              id,
              name,
              teacher_id,
              teachers (
                id,
                name,
                email
              )
            )
          )
        `)
        .eq('parent_id', parentData.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error loading children data')
        return
      }

      // Transform the data
      const studentsData = studentParentsData?.map((sp: any) => ({
        id: sp.students.id,
        name: sp.students.name,
        class_id: sp.students.class_id,
        created_at: sp.students.created_at,
        class: sp.students.classes
      })) || []

      setStudents(studentsData)

      // Get unique class IDs
      const classIds = [...new Set(studentsData.map(s => s.class_id).filter(Boolean))]

      // Get posts for all classes this parent's children are in
      let allPosts: Post[] = []
      if (classIds.length > 0) {
        // Get posts that are tagged to any of this parent's students
        const { data: postsData, error: postsError } = await supabase
          .from('post_student_tags')
          .select(`
            post_id,
            posts (
              id,
              content,
              created_at,
              teachers (
                id,
                name,
                email
              )
            )
          `)
          .in('student_id', studentsData.map(s => s.id))

        if (postsError) {
          console.error('Error fetching posts:', postsError)
        } else {
          // Transform posts data
          allPosts = postsData?.map((item: any) => ({
            id: item.posts.id,
            content: item.posts.content,
            created_at: item.posts.created_at,
            teacher: item.posts.teachers
          })) || []
        }
      }

      setPosts(allPosts)

      // Calculate stats
      const uniqueClasses = new Set(studentsData.map(s => s.class_id).filter(Boolean))
      setStats({
        children: studentsData.length,
        classes: uniqueClasses.size,
        posts: allPosts.length
      })

    } catch (error) {
      console.error('Error fetching parent data:', error)
      toast.error('Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading your dashboard...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Parent Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.name}! Stay connected with your children's education.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 mb-8 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Children</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.children}</div>
              <p className="text-xs text-muted-foreground">
                Students registered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.classes}</div>
              <p className="text-xs text-muted-foreground">
                Active classes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Updates</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.posts}</div>
              <p className="text-xs text-muted-foreground">
                Teacher posts
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Children Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="w-5 h-5" />
                <span>Your Children</span>
              </CardTitle>
              <CardDescription>
                View your children's classes and teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Found</h3>
                  <p className="text-gray-600 mb-4">
                    Your children haven't been linked to your account yet. Please contact your school administrator.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div key={student.id} className="border rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{student.name}</h4>
                          <p className="text-sm text-gray-600">Student</p>
                        </div>
                      </div>
                      
                      {student.class ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">Class:</span>
                            <Badge variant="secondary">{student.class.name}</Badge>
                          </div>
                          {student.class.teacher && (
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-600">Teacher:</span>
                              <span className="text-sm font-medium">{student.class.teacher.name}</span>
                              {student.class.teacher.email && (
                                <div className="flex items-center space-x-1">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{student.class.teacher.email}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not assigned to a class yet</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Updates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Recent Updates</span>
              </CardTitle>
              <CardDescription>
                Latest posts from your children's teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Updates Yet</h3>
                  <p className="text-gray-600">
                    Teachers will post updates about your children's progress here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.slice(0, 5).map((post) => (
                    <div key={post.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {post.teacher && (
                            <span className="text-sm font-medium text-blue-600">
                              {post.teacher.name}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 whitespace-pre-wrap text-sm">{post.content}</p>
                    </div>
                  ))}
                  {posts.length > 5 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm">
                        View All Updates
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
} 