'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  User,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Post {
  id: string
  content: string
  created_at: string
  teacher_id: string
  image_url?: string
  file_url?: string
  file_name?: string
  file_urls?: string[]
  file_names?: string[]
  teacher?: {
    id: string
    name: string
    email: string
  }
  student?: {
    id: string
    name: string
    class?: {
      id: string
      name: string
      academic_period?: {
        id: string
        name: string
        type: string
        school_year: string
      }
    }
  }
}

export default function ParentPostsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  
  // Add ref to track if data has been fetched
  const hasFetchedData = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (user && !hasFetchedData.current) {
      hasFetchedData.current = true
      fetchPosts()
    } else if (!user) {
      // Reset the ref when user is null
      hasFetchedData.current = false
    }
  }, [user])

  // Add a function to manually refresh data
  const refreshData = () => {
    hasFetchedData.current = false
    fetchPosts()
  }

  // Add visibility change listener to refresh data when tab becomes visible
  useEffect(() => {
    let lastHiddenTime: number | null = null

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenTime = Date.now()
      } else if (!document.hidden && user && hasFetchedData.current && lastHiddenTime) {
        // Only refresh if we've been away for more than 10 minutes
        const timeSinceHidden = Date.now() - lastHiddenTime
        if (timeSinceHidden > 10 * 60 * 1000) { // 10 minutes
          console.log('Tab became visible after being hidden for', timeSinceHidden / 1000 / 60, 'minutes, refreshing posts data')
          refreshData()
        }
        lastHiddenTime = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      
      // Store the current fetch time
      sessionStorage.setItem('lastPostsFetch', Date.now().toString())

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
            name,
            class_id
          ),
          posts (
            id,
            content,
            created_at,
            teacher_id,
            class_id,
            image_url,
            file_url,
            file_name,
            file_urls,
            file_names,
            classes (
              id,
              name,
              academic_period_id,
              academic_periods (
                id,
                name,
                type,
                school_year
              )
            )
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
          .map((item: any) => {
            const classData = item.posts?.classes
            return {
              id: item.posts.id,
              content: item.posts.content,
              created_at: item.posts.created_at,
              teacher_id: item.posts.teacher_id,
              image_url: item.posts.image_url,
              file_url: item.posts.file_url,
              file_name: item.posts.file_name,
              file_urls: item.posts.file_urls,
              file_names: item.posts.file_names,
              student: {
                id: item.students.id,
                name: item.students.name,
                class: classData ? {
                  id: classData.id,
                  name: classData.name,
                  academic_period: classData.academic_periods
                } : undefined
              }
            }
          })
        
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

  if (loading && !hasFetchedData.current && isClient) {
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Teacher Posts
              </h1>
              <p className="text-gray-600 mt-2">
                Updates from teachers about your children
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {loading && hasFetchedData.current && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Refreshing...</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                className="text-xs"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
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
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          {post.teacher && (
                            <span className="text-sm font-medium text-blue-600">
                              {post.teacher.name}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1">
                            {post.student && (
                              <Badge variant="outline" className="text-xs">
                                {post.student.name}
                              </Badge>
                            )}
                            {post.student?.class && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 border border-purple-200">
                                📚 {post.student.class.name}
                              </Badge>
                            )}
                            {post.student?.class?.academic_period && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border border-green-200">
                                📅 {post.student.class.academic_period.name}
                              </Badge>
                            )}
                          </div>
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
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed mb-3">
                    {post.content}
                  </p>
                  
                  {/* Display multiple images if present */}
                  {post.file_urls && post.file_urls.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {post.file_urls.map((url, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={url} 
                            alt={`Post image ${index + 1}`} 
                            className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(url, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Fallback for old single image format */}
                  {post.image_url && !post.file_urls && (
                    <div className="mt-3">
                      <img 
                        src={post.image_url} 
                        alt="Post image"
                        className="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" 
                        style={{ maxHeight: 400 }}
                        onClick={() => window.open(post.image_url, '_blank')}
                      />
                    </div>
                  )}
                  
                  {/* Fallback for file_url format */}
                  {post.file_url && !post.file_urls && !post.image_url && (
                    post.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                      <div className="mt-3">
                        <img 
                          src={post.file_url} 
                          alt="Post attachment" 
                          className="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" 
                          style={{ maxHeight: 400 }}
                          onClick={() => window.open(post.file_url, '_blank')}
                        />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <a 
                          href={post.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 underline hover:text-blue-800"
                        >
                          📎 {post.file_name || 'Download attachment'}
                        </a>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
} 