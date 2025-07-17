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
  Mail,
  Eye,
  ThumbsUp,
  Heart,
  Star,
  Smile
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { toast } from 'sonner'
import Link from 'next/link'

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
  student?: Student
  image_url?: string
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
  userReactions?: string[]
}

interface ClassAnnouncement {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
  class?: Class
  image_url?: string
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
  userReactions?: string[]
}

export default function ParentDashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [classAnnouncements, setClassAnnouncements] = useState<ClassAnnouncement[]>([])
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
    if (!user || !user.id) {
      console.log('User not loaded yet, skipping fetchParentData')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      console.log('Fetching parent data for:', user?.email)

      // First, find the parent record by auth user ID
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('id', user.id)
        .single()

      if (parentError) {
        console.error('Error fetching parent:', parentError)
        toast.error('Error loading parent data')
        return
      }

      if (!parentData) {
        console.log('No parent record found for user ID:', user.id)
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
              ),
              image_url
            ),
            students (
              id,
              name
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
            teacher: item.posts.teachers,
            student: item.students,
            image_url: item.posts.image_url
          })) || []
        }
      }

      // 2. In fetchParentData, after transforming allPosts, fetch reactions for each post
      if (allPosts.length > 0) {
        allPosts = await Promise.all(
          allPosts.map(async (post) => {
            // Get reaction counts for this post
            const { data: reactionCounts, error: reactionCountsError } = await supabase
              .from('post_reactions')
              .select('reaction_type')
              .eq('post_id', post.id)
            // Get user's reactions for this post
            const { data: userReactions, error: userReactionsError } = await supabase
              .from('post_reactions')
              .select('reaction_type')
              .eq('post_id', post.id)
              .eq('parent_id', user.id)
            // Calculate reaction counts
            const reactions = { thumbs_up: 0, heart: 0, clap: 0, smile: 0 }
            if (!reactionCountsError && reactionCounts) {
              reactionCounts.forEach((reaction: any) => {
                if (reactions.hasOwnProperty(reaction.reaction_type)) {
                  reactions[reaction.reaction_type as keyof typeof reactions]++
                }
              })
            }
            // Get user's reactions
            const userReactionTypes = userReactions?.map((r: any) => r.reaction_type) || []
            return {
              ...post,
              reactions,
              userReactions: userReactionTypes
            }
          })
        )
      }

      setPosts(allPosts)

      // Get class announcements for all classes this parents children are in
      let allClassAnnouncements: ClassAnnouncement[] = []
      if (classIds.length > 0) {
        const { data: announcementsData, error: announcementsError } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            created_at,
            class_id,
            teachers (
              id,
              name,
              email
            ),
            classes (
              id,
              name
            ),
            image_url
          `)
          .in('class_id', classIds)
          .not('class_id', 'is', null)
          .order('created_at', { ascending: false })

        if (announcementsError) {
          console.error('Error fetching class announcements:', announcementsError)
        } else {
          // Transform announcements data and fetch reactions
          allClassAnnouncements = await Promise.all(
            (announcementsData || []).map(async (item: any) => {
              // Get reaction counts for this announcement
              const { data: reactionCounts, error: reactionCountsError } = await supabase
                .from('post_reactions')
                .select('reaction_type')
                .eq('post_id', item.id)

              // Get user's reactions for this announcement
              const { data: userReactions, error: userReactionsError } = await supabase
                .from('post_reactions')
                .select('reaction_type')
                .eq('post_id', item.id)
                .eq('parent_id', user.id)

              // Calculate reaction counts
              const reactions = {
                thumbs_up: 0,
                heart: 0,
                clap: 0,
                smile:0               }

              if (!reactionCountsError && reactionCounts) {
                reactionCounts.forEach((reaction: any) => {
                  if (reactions.hasOwnProperty(reaction.reaction_type)) {
                    reactions[reaction.reaction_type as keyof typeof reactions]++
                  }
                })
              }

              // Get user's reactions
              const userReactionTypes = userReactions?.map((r: any) => r.reaction_type) || []

              return {
                id: item.id,
                content: item.content,
                created_at: item.created_at,
                teacher: item.teachers,
                class: item.classes,
                image_url: item.image_url,
                reactions,
                userReactions: userReactionTypes
              }
            })
          )
        }
      }

      setClassAnnouncements(allClassAnnouncements)

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

  // 3. Update handleReaction to work for both class announcements and posts
  const handleReaction = async (postId: string, reactionType: string, isAnnouncement = false) => {
    if (!user) return
    if (isAnnouncement) {
      // Find the announcement in state
      const announcementIndex = classAnnouncements.findIndex(a => a.id === postId)
      if (announcementIndex === -1) return
      const announcement = classAnnouncements[announcementIndex]
      const userHasReaction = announcement.userReactions?.includes(reactionType) || false
      // Optimistic update - update UI immediately
      const updatedAnnouncements = [...classAnnouncements]
      const updatedAnnouncement = { ...announcement }
      if (!updatedAnnouncement.reactions) updatedAnnouncement.reactions = { thumbs_up: 0, heart: 0, clap:0, smile: 0 }
      if (!updatedAnnouncement.userReactions) updatedAnnouncement.userReactions = []
      if (userHasReaction) {
        updatedAnnouncement.reactions[reactionType as keyof typeof updatedAnnouncement.reactions]--
        updatedAnnouncement.userReactions = updatedAnnouncement.userReactions.filter(r => r !== reactionType)
      } else {
        updatedAnnouncement.reactions[reactionType as keyof typeof updatedAnnouncement.reactions]++
        updatedAnnouncement.userReactions = [...updatedAnnouncement.userReactions, reactionType]
      }
      updatedAnnouncements[announcementIndex] = updatedAnnouncement
      setClassAnnouncements(updatedAnnouncements)
      try {
        if (userHasReaction) {
          const { error: deleteError } = await supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('parent_id', user.id)
            .eq('reaction_type', reactionType)
          if (deleteError) {
            toast.error('Error removing reaction')
            setClassAnnouncements(classAnnouncements)
            return
          }
        } else {
          const { error: insertError } = await supabase
            .from('post_reactions')
            .insert([{ post_id: postId, parent_id: user.id, reaction_type: reactionType }])
          if (insertError) {
            toast.error('Error adding reaction')
            setClassAnnouncements(classAnnouncements)
            return
          }
        }
      } catch (error) {
        toast.error('Error updating reaction')
        setClassAnnouncements(classAnnouncements)
      }
    } else {
      // Find the post in state
      const postIndex = posts.findIndex(p => p.id === postId)
      if (postIndex === -1) return
      const post = posts[postIndex]
      const userHasReaction = post.userReactions?.includes(reactionType) || false
      // Optimistic update
      const updatedPosts = [...posts]
      const updatedPost = { ...post }
      if (!updatedPost.reactions) updatedPost.reactions = { thumbs_up: 0, heart: 0, clap: 0, smile: 0 }
      if (!updatedPost.userReactions) updatedPost.userReactions = []
      if (userHasReaction) {
        updatedPost.reactions[reactionType as keyof typeof updatedPost.reactions]--
        updatedPost.userReactions = updatedPost.userReactions.filter(r => r !== reactionType)
      } else {
        updatedPost.reactions[reactionType as keyof typeof updatedPost.reactions]++
        updatedPost.userReactions = [...updatedPost.userReactions, reactionType]
      }
      updatedPosts[postIndex] = updatedPost
      setPosts(updatedPosts)
      try {
        if (userHasReaction) {
          const { error: deleteError } = await supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('parent_id', user.id)
            .eq('reaction_type', reactionType)
          if (deleteError) {
            toast.error('Error removing reaction')
            setPosts(posts)
            return
          }
        } else {
          const { error: insertError } = await supabase
            .from('post_reactions')
            .insert([{ post_id: postId, parent_id: user.id, reaction_type: reactionType }])
          if (insertError) {
            toast.error('Error adding reaction')
            setPosts(posts)
            return
          }
        }
      } catch (error) {
        toast.error('Error updating reaction')
        setPosts(posts)
      }
    }
  }

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return <ThumbsUp className="w-4 h-4" />
      case 'heart':
        return <Heart className="w-4 h-4" />
      case 'clap':
        return <Star className="w-4 h-4" />
      case 'smile':
        return <Smile className="w-4 h-4" />
      default:
        return <ThumbsUp className="w-4 h-4" />
    }
  }

  const getReactionColor = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return 'text-blue-600 hover:text-blue-700'
      case 'heart':
        return 'text-red-600 hover:text-red-700'
      case 'clap':
        return 'text-yellow-600 hover:text-yellow-700'
      case 'smile':
        return 'text-green-600 hover:text-green-700'
      default:
        return 'text-gray-600 hover:text-gray-700'
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

        {/* Class Announcements Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Class Announcements</span>
            </CardTitle>
            <CardDescription>
              Important announcements from your children's teachers for entire classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classAnnouncements.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Class Announcements</h3>
                <p className="text-gray-600">
                  Teachers will post class-wide announcements here when available.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {classAnnouncements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {announcement.teacher && (
                          <span className="text-sm font-medium text-blue-600">
                            {announcement.teacher.name}
                          </span>
                        )}
                        {announcement.class && (
                          <span className="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            {announcement.class.name}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap text-sm mb-3">{announcement.content}</p>
                    {announcement.image_url && (
                      <div className="mt-3">
                        <img 
                          src={announcement.image_url} 
                          alt="Post image"
                          className="max-w-full h-auto rounded-lg border"
                          style={{ maxHeight: 400 }}
                        />
                      </div>
                    )}
                    <div className="flex items-center mt-4 space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'thumbs_up', true)}
                        className={`${getReactionColor('thumbs_up')} ${announcement.userReactions?.includes('thumbs_up') ? 'text-blue-600' : ''}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {announcement.reactions?.thumbs_up || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'heart', true)}
                        className={`${getReactionColor('heart')} ${announcement.userReactions?.includes('heart') ? 'text-red-600' : ''}`}
                      >
                        <Heart className="w-4 h-4" />
                        {announcement.reactions?.heart || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'clap', true)}
                        className={`${getReactionColor('clap')} ${announcement.userReactions?.includes('clap') ? 'text-yellow-600' : ''}`}
                      >
                        <Star className="w-4 h-4" />
                        {announcement.reactions?.clap || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'smile', true)}
                        className={`${getReactionColor('smile')} ${announcement.userReactions?.includes('smile') ? 'text-green-600' : ''}`}
                      >
                        <Smile className="w-4 h-4" />
                        {announcement.reactions?.smile || 0}
                      </Button>
                    </div>
                  </div>
                ))}
                {classAnnouncements.length > 3 && (
                  <div className="text-center pt-4">
                    <Button variant="outline" size="sm">
                      View All Announcements
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{student.name}</h4>
                            <p className="text-sm text-gray-600">Student</p>
                          </div>
                        </div>
                        <Link href={`/parent/children/${student.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </Link>
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
                          {post.student && (
                            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                              {post.student.name}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 whitespace-pre-wrap text-sm mb-3">{post.content}</p>
                      {post.image_url && (
                        <div className="mt-3">
                          <img 
                            src={post.image_url} 
                            alt="Post image"
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: 400 }}
                          />
                        </div>
                      )}
                      <div className="flex items-center mt-2 space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'thumbs_up', false)}
                          className={`${getReactionColor('thumbs_up')} ${post.userReactions?.includes('thumbs_up') ? 'text-blue-600' : ''}`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {post.reactions?.thumbs_up || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'heart', false)}
                          className={`${getReactionColor('heart')} ${post.userReactions?.includes('heart') ? 'text-red-600' : ''}`}
                        >
                          <Heart className="w-4 h-4" />
                          {post.reactions?.heart || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'clap', false)}
                          className={`${getReactionColor('clap')} ${post.userReactions?.includes('clap') ? 'text-yellow-600' : ''}`}
                        >
                          <Star className="w-4 h-4" />
                          {post.reactions?.clap || 0}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'smile', false)}
                          className={`${getReactionColor('smile')} ${post.userReactions?.includes('smile') ? 'text-green-600' : ''}`}
                        >
                          <Smile className="w-4 h-4" />
                          {post.reactions?.smile || 0}
                        </Button>
                      </div>
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