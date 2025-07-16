'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  User, 
  GraduationCap,
  Calendar,
  ArrowLeft,
  MessageSquare
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import Link from 'next/link'

interface Class {
  id: string
  name: string
  created_at: string
  teacher_id: string
  teacher?: Teacher
}

interface Teacher {
  id: string
  name: string
  email: string
}

interface Child {
  id: string
  name: string
  created_at: string
}

interface Post {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
  student?: {
    id: string
    name: string
  }
}

export default function ParentClassDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const classId = params.id as string
  
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (classId && user) {
      fetchClassDetails()
    }
  }, [classId, user])

  const fetchClassDetails = async () => {
    if (!user || !classId) return

    try {
      setLoading(true)

      // Fetch class information
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          created_at,
          teacher_id,
          teachers (
            id,
            name,
            email
          )
        `)
        .eq('id', classId)
        .single()

      if (classError) {
        console.error('Error fetching class:', classError)
        toast.error('Error fetching class details')
        return
      }

      setClassInfo(classData)

      // Get children linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', user.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        return
      }

      const studentIds = studentParentsData?.map(sp => sp.student_id) || []

      if (studentIds.length === 0) {
        setChildren([])
        setPosts([])
        setLoading(false)
        return
      }

      // Fetch children in this class
      const { data: childrenData, error: childrenError } = await supabase
        .from('students')
        .select('id, name, created_at')
        .eq('class_id', classId)
        .in('id', studentIds)
        .order('created_at', { ascending: false })

      if (childrenError) {
        console.error('Error fetching children:', childrenError)
      } else {
        setChildren(childrenData || [])
      }

      // Fetch posts for this class (posts that mention children in this class)
      const { data: tagData, error: tagError } = await supabase
        .from('post_student_tags')
        .select(`
          post_id,
          student_id,
          students (
            id,
            name
          ),
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
        .in('student_id', studentIds)

      if (tagError) {
        console.error('Error fetching posts:', tagError)
        setPosts([])
      } else if (tagData && tagData.length > 0) {
        // Transform posts data and remove duplicates
        const postsData = tagData
          .filter((item: any) => item.posts) // Filter out null posts
          .map((item: any) => ({
            id: item.posts.id,
            content: item.posts.content,
            created_at: item.posts.created_at,
            teacher: item.posts.teachers,
            student: item.students
          }))
        
        // Remove duplicates based on post ID
        const uniquePosts = postsData.filter((post, index, self) => 
          index === self.findIndex(p => p.id === post.id)
        )
        
        // Sort by creation date (newest first)
        uniquePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        setPosts(uniquePosts)
      } else {
        setPosts([])
      }

    } catch (error) {
      console.error('Error fetching class details:', error)
      toast.error('Error fetching class details')
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
              <p className="mt-2 text-gray-600">Loading class details...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!classInfo) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Class not found</p>
            <Link href="/parent/classes" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to Classes
            </Link>
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
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/parent/classes" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {classInfo.name}
              </h1>
              <p className="text-gray-600 mt-2">
                Class details and updates
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Class Information */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Class Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{classInfo.name}</h3>
                      <p className="text-sm text-gray-500">Class</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm font-medium">
                        {new Date(classInfo.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {classInfo.teacher && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Teacher:</span>
                        <span className="text-sm font-medium">{classInfo.teacher.name}</span>
                        {classInfo.teacher.email && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">({classInfo.teacher.email})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Children in This Class */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5" />
                  <span>Your Children in This Class</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {children.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">None of your children are enrolled in this class.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-gray-500">
                            Joined {new Date(child.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Class Updates */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Class Updates</span>
                </CardTitle>
                <CardDescription>
                  Recent posts about your children in this class
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
                                         {posts.map((post) => (
                       <div key={post.id} className="border rounded-lg p-4">
                         <div className="flex items-start justify-between mb-2">
                           <div className="flex items-center space-x-2">
                             {post.teacher && (
                               <span className="text-sm font-medium text-blue-600">
                                 {post.teacher.name}
                               </span>
                             )}
                             {post.student && (
                               <Badge variant="outline" className="text-xs">
                                 {post.student.name}
                               </Badge>
                             )}
                           </div>
                           <span className="text-sm text-gray-500">
                             {new Date(post.created_at).toLocaleDateString()}
                           </span>
                         </div>
                         <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
                       </div>
                     ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
} 