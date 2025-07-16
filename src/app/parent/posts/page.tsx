'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  User,
  Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'

interface Post {
  id: string
  content: string
  created_at: string
  teacher_id: string
  teacher?: {
    id: string
    name: string
    email: string
  }
  student?: {
    id: string
    name: string
  }
}

export default function ParentPostsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPosts()
    }
  }, [user])

  const fetchPosts = async () => {
    if (!user) {
      console.log('User not loaded yet, skipping fetchPosts')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Fetching posts for parent:', user.email)

      // Get children linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', user.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error fetching posts')
        return
      }

      if (!studentParentsData || studentParentsData.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }

      const studentIds = studentParentsData.map(sp => sp.student_id)

      // Fetch posts about the parent's children
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
            teacher_id
          )
        `)
        .in('student_id', studentIds)

      if (tagError) {
        console.error('Error fetching posts:', tagError)
        toast.error('Error fetching posts')
        setPosts([])
        return
      }

      if (tagData && tagData.length > 0) {
        // Transform posts data and remove duplicates
        const postsData = tagData
          .filter((item: any) => item.posts) // Filter out null posts
          .map((item: any) => ({
            id: item.posts.id,
            content: item.posts.content,
            created_at: item.posts.created_at,
            teacher_id: item.posts.teacher_id,
            student: item.students
          }))
        
        // Remove duplicates based on post ID
        const uniquePosts = postsData.filter((post, index, self) => 
          index === self.findIndex(p => p.id === post.id)
        )
        
        // Sort by creation date (newest first)
        uniquePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        // Fetch teacher information for all posts
        const teacherIds = [...new Set(uniquePosts.map(post => post.teacher_id).filter(Boolean))]
        
        if (teacherIds.length > 0) {
          const { data: teachersData, error: teachersError } = await supabase
            .from('teachers')
            .select('id, name, email')
            .in('id', teacherIds)
          
          if (!teachersError && teachersData) {
            const teachersMap = new Map(teachersData.map(teacher => [teacher.id, teacher]))
            
            // Add teacher information to posts
            const postsWithTeachers = uniquePosts.map(post => ({
              ...post,
              teacher: teachersMap.get(post.teacher_id)
            }))
            
            setPosts(postsWithTeachers)
          } else {
            setPosts(uniquePosts)
          }
        } else {
          setPosts(uniquePosts)
        }
      } else {
        setPosts([])
      }

    } catch (error) {
      console.error('Error fetching posts:', error)
      toast.error('Error fetching posts')
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
              <p className="mt-2 text-gray-600">Loading teacher posts...</p>
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
            Teacher Posts
          </h1>
          <p className="text-gray-600 mt-2">
            Updates from teachers about your children
          </p>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Posts Yet</h3>
                <p className="text-gray-600">
                  Teachers will post updates about your children here. Check back later for updates.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
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
                        <CardDescription className="flex items-center space-x-2 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
} 