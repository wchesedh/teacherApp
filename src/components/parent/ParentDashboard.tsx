'use client'

import { useState, useEffect, useRef } from 'react'
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
  Smile,
  RefreshCw,
  Phone
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { toast } from 'sonner'
import Link from 'next/link'

// Helper function to format date and time
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  }
  const dateStr = date.toLocaleDateString('en-US', options)
  
  if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
    return `Today at ${timeStr} (${dateStr})`
  }
  
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeStr} (${dateStr})`
  }
  
  // For posts older than yesterday, show the full date
  return `${dateStr} at ${timeStr}`
}

interface Student {
  id: string
  name: string
  class_id: string | null
  created_at: string
  avatar_url?: string
  class?: Class
  classes?: Class[]
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
  class?: Class
  image_url?: string
  file_url?: string
  file_name?: string
  file_urls?: string[]
  file_names?: string[]
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
  file_url?: string
  file_name?: string
  file_urls?: string[]
  file_names?: string[]
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
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [loadingStudentDetails, setLoadingStudentDetails] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({
    children: 0,
    classes: 0,
    posts: 0
  })
  const [isClient, setIsClient] = useState(false)
  
  // Add ref to track if data has been fetched
  const hasFetchedData = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (user && !hasFetchedData.current) {
      hasFetchedData.current = true
      fetchParentData()
    } else if (!user) {
      // Reset the ref when user is null
      hasFetchedData.current = false
    }
  }, [user])

  // Add a function to manually refresh data
  const refreshData = () => {
    hasFetchedData.current = false
    fetchParentData()
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
          console.log('Tab became visible after being hidden for', timeSinceHidden / 1000 / 60, 'minutes, refreshing data')
          refreshData()
        }
        lastHiddenTime = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      
      // Store the current fetch time
      sessionStorage.setItem('lastDataFetch', Date.now().toString())

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
      let studentsData: Student[] = []
      
              try {
          const { data: studentParentsData, error: studentParentsError } = await supabase
          .from('student_parent')
          .select(`
            students!student_parent_student_id_fkey (
              id,
              name,
              class_id,
              created_at,
              avatar_url
            )
          `)
          .eq('parent_id', parentData.id)

        if (studentParentsError) {
          console.error('Error fetching student-parent relationships:', studentParentsError)
          console.error('Error details:', {
            parentId: parentData.id,
            error: studentParentsError,
            message: studentParentsError.message,
            details: studentParentsError.details,
            hint: studentParentsError.hint
          })
          
          // If student_parent table fails, just return empty students array
          console.log('student_parent table query failed, returning empty students for parent:', parentData.id)
          studentsData = []
        } else {
          // Transform the data and fetch all classes for each student
          const studentsWithClasses = await Promise.all(
            (studentParentsData || []).map(async (sp: any) => {
                          // Get all classes for this student using student_class table
            const { data: studentClassesData, error: studentClassesError } = await supabase
              .from('student_class')
              .select(`
                classes!student_class_class_id_fkey (
                  id,
                  name,
                  teacher_id,
                  teachers!classes_teacher_id_fkey (
                    id,
                    name,
                    email
                  )
                )
              `)
              .eq('student_id', sp.students.id)

              if (studentClassesError) {
                console.error('Error fetching classes for student:', sp.students.id, studentClassesError)
                // Fallback to single class if student_class table fails
                const { data: singleClassData, error: singleClassError } = await supabase
                  .from('classes')
                  .select(`
                    id,
                    name,
                    teacher_id,
                    teachers!classes_teacher_id_fkey (
                      id,
                      name,
                      email
                    )
                  `)
                  .eq('id', sp.students.class_id)
                  .single()

                if (singleClassError) {
                  console.error('Error fetching single class for student:', sp.students.id, singleClassError)
                                  return {
                  id: sp.students.id,
                  name: sp.students.name,
                  class_id: sp.students.class_id,
                  created_at: sp.students.created_at,
                  avatar_url: sp.students.avatar_url,
                  class: undefined,
                  classes: []
                }
                }

                return {
                  id: sp.students.id,
                  name: sp.students.name,
                  class_id: sp.students.class_id,
                  created_at: sp.students.created_at,
                  avatar_url: sp.students.avatar_url,
                  class: singleClassData,
                  classes: singleClassData ? [singleClassData] : []
                }
              }

              const classes = studentClassesData?.map((sc: any) => sc.classes) || []
              
              return {
                id: sp.students.id,
                name: sp.students.name,
                class_id: sp.students.class_id,
                created_at: sp.students.created_at,
                avatar_url: sp.students.avatar_url,
                class: classes[0] || undefined, // Keep for backward compatibility
                classes: classes
              }
            })
          )

          studentsData = studentsWithClasses
        }
      } catch (error) {
        console.error('Error processing student-parent relationships:', error)
        studentsData = []
      }

      setStudents(studentsData)

      // Get unique class IDs from all classes of all students
      const allClassIds = studentsData.flatMap(s => 
        s.classes ? s.classes.map(c => c.id) : (s.class_id ? [s.class_id] : [])
      )
      const classIds = [...new Set(allClassIds)]

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
              image_url,
              file_url,
              file_name,
              file_urls,
              file_names
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
            class: item.posts.classes,
            image_url: item.posts.image_url,
            file_url: item.posts.file_url,
            file_name: item.posts.file_name,
            file_urls: item.posts.file_urls,
            file_names: item.posts.file_names
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
            image_url,
            file_url,
            file_name,
            file_urls,
            file_names
          `)
          .in('class_id', classIds)
          .not('class_id', 'is', null)
          .order('created_at', { ascending: false })

        if (announcementsError) {
          console.error('Error fetching class announcements:', announcementsError)
        } else {
          // Filter out posts that are tagged with specific students (student posts)
          const { data: studentTaggedPosts, error: studentTagsError } = await supabase
            .from('post_student_tags')
            .select('post_id')
            .in('post_id', (announcementsData || []).map(post => post.id))

          if (studentTagsError) {
            console.error('Error fetching student tags:', studentTagsError)
            // If we can't fetch student tags, show all posts as announcements
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
                  smile: 0
                }

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
                  file_url: item.file_url,
                  file_name: item.file_name,
                  file_urls: item.file_urls,
                  file_names: item.file_names,
                  reactions,
                  userReactions: userReactionTypes
                }
              })
            )
          } else {
            // Get the IDs of posts that are tagged with students
            const studentTaggedPostIds = studentTaggedPosts?.map(tag => tag.post_id) || []

            // Filter out student posts from announcements
            const classAnnouncementsOnly = (announcementsData || []).filter(
              post => !studentTaggedPostIds.includes(post.id)
            )

            // Transform announcements data and fetch reactions using classAnnouncementsOnly
            allClassAnnouncements = await Promise.all(
              (classAnnouncementsOnly || []).map(async (item: any) => {
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
                  smile: 0
                }

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
                  file_url: item.file_url,
                  file_name: item.file_name,
                  file_urls: item.file_urls,
                  file_names: item.file_names,
                  reactions,
                  userReactions: userReactionTypes
                }
              })
            )
          }
        }
      }

      setClassAnnouncements(allClassAnnouncements)

      // Calculate stats
      const uniqueClasses = new Set(allClassIds)
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

  if (loading && !hasFetchedData.current && isClient) {
    return (
      <Layout>
        <div className="p-4 sm:p-8">
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
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Parent Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                Welcome back, {user?.name}! Stay connected with your children's education.
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

        {/* Stats Cards */}
        <div className="grid gap-4 sm:gap-6 mb-6 sm:mb-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Your Children</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.children}</div>
              <p className="text-xs text-muted-foreground">
                Students registered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.classes}</div>
              <p className="text-xs text-muted-foreground">
                Active classes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Updates</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.posts}</div>
              <p className="text-xs text-muted-foreground">
                Teacher posts
              </p>
            </CardContent>
          </Card>


        </div>

        {/* Class Announcements Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Class Announcements</span>
            </CardTitle>
            <CardDescription className="text-sm">
              Important announcements from your children's teachers for entire classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classAnnouncements.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <MessageSquare className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900">No Class Announcements</h3>
                <p className="text-sm text-gray-600">
                  Teachers will post class-wide announcements here when available.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {classAnnouncements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="border rounded-lg p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 space-y-2 sm:space-y-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {announcement.teacher && (
                          <Link href={`/parent/teachers/${announcement.teacher.id}`}>
                            <span className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                              {announcement.teacher.name}
                            </span>
                          </Link>
                        )}
                        {announcement.class && (
                          <span className="text-xs sm:text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            {announcement.class.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {formatDateTime(announcement.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap text-xs sm:text-sm mb-3">{announcement.content}</p>
                    
                    {/* Display multiple images if present */}
                    {announcement.file_urls && announcement.file_urls.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {announcement.file_urls.map((url, index) => (
                          <div key={index} className="relative">
                            <img 
                              src={url} 
                              alt={`Announcement image ${index + 1}`} 
                              className="w-full h-32 sm:h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, '_blank')}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Fallback for old single file format */}
                    {announcement.file_url && !announcement.file_urls && (
                      announcement.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                        <div className="mt-3">
                          <img 
                            src={announcement.file_url} 
                            alt="Announcement attachment"
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: 400 }}
                          />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <a 
                            href={announcement.file_url} 
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="text-blue-600 underline hover:text-blue-800 text-sm"
                          >
                            📎 {announcement.file_name || 'Download attachment'}
                          </a>
                        </div>
                      )
                    )}
                    <div className="flex flex-wrap items-center mt-4 gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'thumbs_up', true)}
                        className={`${getReactionColor('thumbs_up')} ${announcement.userReactions?.includes('thumbs_up') ? 'text-blue-600' : ''} text-xs sm:text-sm`}
                      >
                        <ThumbsUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="ml-1">{announcement.reactions?.thumbs_up || 0}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'heart', true)}
                        className={`${getReactionColor('heart')} ${announcement.userReactions?.includes('heart') ? 'text-red-600' : ''} text-xs sm:text-sm`}
                      >
                        <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="ml-1">{announcement.reactions?.heart || 0}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'clap', true)}
                        className={`${getReactionColor('clap')} ${announcement.userReactions?.includes('clap') ? 'text-yellow-600' : ''} text-xs sm:text-sm`}
                      >
                        <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="ml-1">{announcement.reactions?.clap || 0}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'smile', true)}
                        className={`${getReactionColor('smile')} ${announcement.userReactions?.includes('smile') ? 'text-green-600' : ''} text-xs sm:text-sm`}
                      >
                        <Smile className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="ml-1">{announcement.reactions?.smile || 0}</span>
                      </Button>
                    </div>
                  </div>
                ))}
                {classAnnouncements.length > 3 && (
                  <div className="text-center pt-4">
                    <Link href="/parent/announcements">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setLoadingAnnouncements(true)}
                        disabled={loadingAnnouncements}
                        className="text-xs sm:text-sm"
                      >
                        {loadingAnnouncements ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600 mr-2"></div>
                            Loading...
                          </>
                        ) : (
                          'View All Announcements'
                        )}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Children Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Your Children</span>
              </CardTitle>
              <CardDescription className="text-sm">
                View your children's classes and teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <GraduationCap className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Children Found</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Your children haven't been linked to your account yet. Please contact your school administrator.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div key={student.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3">
                          {student.avatar_url ? (
                            <img 
                              src={student.avatar_url} 
                              alt={`${student.name} avatar`} 
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm sm:text-base">{student.name}</h4>
                            <p className="text-xs sm:text-sm text-gray-600">Student</p>
                          </div>
                        </div>
                        <Link href={`/parent/children/${student.id}`}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setLoadingStudentDetails(prev => new Set(prev).add(student.id))
                            }}
                            disabled={loadingStudentDetails.has(student.id)}
                            className="text-xs sm:text-sm"
                          >
                            {loadingStudentDetails.has(student.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                Loading...
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                View Details
                              </>
                            )}
                          </Button>
                        </Link>
                      </div>
                      
                      {student.classes && student.classes.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                            <span className="text-xs sm:text-sm text-gray-600">Classes:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {student.classes.map((classItem, index) => (
                              <div key={classItem.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <Badge variant="secondary" className="text-xs">{classItem.name}</Badge>
                                {classItem.teacher && (
                                  <Link href={`/parent/teachers/${classItem.teacher.id}`}>
                                    <span className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                                      ({classItem.teacher.name})
                                    </span>
                                  </Link>
                                )}
                                {index < student.classes!.length - 1 && (
                                  <span className="text-xs text-gray-400 hidden sm:inline">•</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : student.class ? (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <div className="flex items-center space-x-2">
                              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                              <span className="text-xs sm:text-sm text-gray-600">Class:</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">{student.class.name}</Badge>
                          </div>
                          {student.class.teacher && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <div className="flex items-center space-x-2">
                                <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                                <span className="text-xs sm:text-sm text-gray-600">Teacher:</span>
                              </div>
                              <Link href={`/parent/teachers/${student.class.teacher.id}`}>
                                <span className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                                  {student.class.teacher.name}
                                </span>
                              </Link>
                              {student.class.teacher.email && (
                                <div className="flex items-center space-x-1">
                                  <Mail className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{student.class.teacher.email}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-gray-500">Not assigned to a class yet</p>
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
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Recent Updates</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Latest posts from your children's teachers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {posts.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <MessageSquare className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Updates Yet</h3>
                  <p className="text-sm text-gray-600">
                    Teachers will post updates about your children's progress here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.slice(0, 5).map((post) => (
                    <div key={post.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 space-y-2 sm:space-y-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {post.teacher && (
                            <Link href={`/parent/teachers/${post.teacher.id}`}>
                              <span className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                                {post.teacher.name}
                              </span>
                            </Link>
                          )}
                          {post.student && (
                            <span className="text-xs sm:text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                              {post.student.name}
                            </span>
                          )}
                          {post.class && (
                            <span className="text-xs sm:text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                              {post.class.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {formatDateTime(post.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-600 whitespace-pre-wrap text-xs sm:text-sm mb-3">{post.content}</p>
                      
                      {/* Display multiple images if present */}
                      {post.file_urls && post.file_urls.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {post.file_urls.map((url, index) => (
                            <div key={index} className="relative">
                              <img 
                                src={url} 
                                alt={`Post image ${index + 1}`} 
                                className="w-full h-32 sm:h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(url, '_blank')}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Fallback for old single file format */}
                      {post.image_url && !post.file_urls && (
                        <div className="mt-3">
                          <img 
                            src={post.image_url} 
                            alt="Post image"
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: 400 }}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center mt-2 gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'thumbs_up', false)}
                          className={`${getReactionColor('thumbs_up')} ${post.userReactions?.includes('thumbs_up') ? 'text-blue-600' : ''} text-xs sm:text-sm`}
                        >
                          <ThumbsUp className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="ml-1">{post.reactions?.thumbs_up || 0}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'heart', false)}
                          className={`${getReactionColor('heart')} ${post.userReactions?.includes('heart') ? 'text-red-600' : ''} text-xs sm:text-sm`}
                        >
                          <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="ml-1">{post.reactions?.heart || 0}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'clap', false)}
                          className={`${getReactionColor('clap')} ${post.userReactions?.includes('clap') ? 'text-yellow-600' : ''} text-xs sm:text-sm`}
                        >
                          <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="ml-1">{post.reactions?.clap || 0}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction(post.id, 'smile', false)}
                          className={`${getReactionColor('smile')} ${post.userReactions?.includes('smile') ? 'text-green-600' : ''} text-xs sm:text-sm`}
                        >
                          <Smile className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="ml-1">{post.reactions?.smile || 0}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {posts.length > 5 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm" className="text-xs sm:text-sm">
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