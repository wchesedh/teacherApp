'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  MessageSquare, 
  ThumbsUp, 
  Heart, 
  Star, 
  Smile,
  Users,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
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

interface Teacher {
  id: string
  name: string
  email: string
}

interface Class {
  id: string
  name: string
  teacher_id: string
  teacher?: Teacher
}

interface Student {
  id: string
  name: string
}

export default function ParentAnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([])
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
      fetchAnnouncements()
    } else if (!user) {
      // Reset the ref when user is null
      hasFetchedData.current = false
    }
  }, [user])

  // Add a function to manually refresh data
  const refreshData = () => {
    hasFetchedData.current = false
    fetchAnnouncements()
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
          console.log('Tab became visible after being hidden for', timeSinceHidden / 1000 / 60, 'minutes, refreshing announcements data')
          refreshData()
        }
        lastHiddenTime = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user])

  const fetchAnnouncements = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Store the current fetch time
      sessionStorage.setItem('lastAnnouncementsFetch', Date.now().toString())

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
        setAnnouncements([])
        return
      }

      // Get students linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select(`
          students!student_parent_student_id_fkey (
            id,
            name
          )
        `)
        .eq('parent_id', parentData.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        setAnnouncements([])
        return
      }

      const students = (studentParentsData?.map(sp => sp.students).flat().filter(Boolean) || []) as Student[]
      
      if (students.length === 0) {
        setAnnouncements([])
        return
      }

      // Get all class IDs from all students using the student_class table
      const studentIds = students.map(s => s.id)
      const { data: studentClassData, error: studentClassError } = await supabase
        .from('student_class')
        .select('class_id')
        .in('student_id', studentIds)

      if (studentClassError) {
        console.error('Error fetching student-class relationships:', studentClassError)
        setAnnouncements([])
        return
      }

      // Extract unique class IDs from all student enrollments
      const classIds = [...new Set(studentClassData?.map(sc => sc.class_id) || [])]

      if (classIds.length === 0) {
        setAnnouncements([])
        return
      }

      // Get class announcements for all classes this parent's children are in
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          class_id,
          image_url,
          file_url,
          file_name,
          file_urls,
          file_names,
          teachers (
            id,
            name,
            email
          ),
          classes (
            id,
            name
          )
        `)
        .in('class_id', classIds)
        .not('class_id', 'is', null)
        .order('created_at', { ascending: false })

      if (announcementsError) {
        console.error('Error fetching class announcements:', announcementsError)
        setAnnouncements([])
        return
      }

      // Filter out posts that are tagged with specific students (student posts)
      const { data: studentTaggedPosts, error: studentTagsError } = await supabase
        .from('post_student_tags')
        .select('post_id')
        .in('post_id', (announcementsData || []).map(post => post.id))

      if (studentTagsError) {
        console.error('Error fetching student tags:', studentTagsError)
        // If we can't fetch student tags, show all posts as announcements
        const announcementsWithReactions = await Promise.all(
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

        setAnnouncements(announcementsWithReactions)
        return
      }

      // Get the IDs of posts that are tagged with students
      const studentTaggedPostIds = studentTaggedPosts?.map(tag => tag.post_id) || []

      // Filter out student posts from announcements
      const classAnnouncementsOnly = (announcementsData || []).filter(
        post => !studentTaggedPostIds.includes(post.id)
      )

      // Transform announcements data and fetch reactions
      const announcementsWithReactions = await Promise.all(
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

      setAnnouncements(announcementsWithReactions)

    } catch (error) {
      console.error('Error fetching announcements:', error)
      toast.error('Error loading announcements')
    } finally {
      setLoading(false)
    }
  }

  const handleReaction = async (announcementId: string, reactionType: string) => {
    if (!user) return

    try {
      // Find the announcement in state
      const announcementIndex = announcements.findIndex(a => a.id === announcementId)
      if (announcementIndex === -1) return
      const announcement = announcements[announcementIndex]
      const userHasReaction = announcement.userReactions?.includes(reactionType) || false

      // Optimistic update - update UI immediately
      const updatedAnnouncements = [...announcements]
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
      setAnnouncements(updatedAnnouncements)

      try {
        if (userHasReaction) {
          const { error: deleteError } = await supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', announcementId)
            .eq('parent_id', user.id)
            .eq('reaction_type', reactionType)
          if (deleteError) {
            toast.error('Error removing reaction')
            setAnnouncements(announcements)
            return
          }
        } else {
          const { error: insertError } = await supabase
            .from('post_reactions')
            .insert([{ post_id: announcementId, parent_id: user.id, reaction_type: reactionType }])
          if (insertError) {
            toast.error('Error adding reaction')
            setAnnouncements(announcements)
            return
          }
        }
      } catch (error) {
        toast.error('Error updating reaction')
        setAnnouncements(announcements)
      }
    } catch (error) {
      toast.error('Error updating reaction')
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
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading announcements...</p>
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
            <div className="flex items-center space-x-4">
              <Link href="/parent" className="text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Class Announcements
                </h1>
                <p className="text-gray-600 mt-2">
                  All announcements from your children's teachers
                </p>
              </div>
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

        {/* Announcements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>All Announcements</span>
              <Badge variant="secondary">{announcements.length}</Badge>
            </CardTitle>
            <CardDescription>
              Important announcements from your children's teachers for entire classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Announcements</h3>
                <p className="text-gray-600">
                  Teachers will post class-wide announcements here when available.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
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
                        {formatDateTime(announcement.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap text-sm mb-4">{announcement.content}</p>
                    
                    {/* Display multiple images if present */}
                    {announcement.file_urls && announcement.file_urls.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {announcement.file_urls.map((url, index) => (
                          <div key={index} className="relative">
                            <img 
                              src={url} 
                              alt={`Announcement image ${index + 1}`} 
                              className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, '_blank')}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Fallback for old single file format */}
                    {announcement.file_url && !announcement.file_urls && (
                      announcement.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                        <div className="mt-4">
                          <img 
                            src={announcement.file_url} 
                            alt="Announcement attachment"
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: 400 }}
                          />
                        </div>
                      ) : (
                        <div className="mt-4">
                          <a 
                            href={announcement.file_url} 
                            target="_blank"
                            rel="noopener noreferrer" 
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            📎 {announcement.file_name || 'Download attachment'}
                          </a>
                        </div>
                      )
                    )}
                    
                    <div className="flex items-center mt-6 space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'thumbs_up')}
                        className={`${getReactionColor('thumbs_up')} ${announcement.userReactions?.includes('thumbs_up') ? 'text-blue-600' : ''}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {announcement.reactions?.thumbs_up || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'heart')}
                        className={`${getReactionColor('heart')} ${announcement.userReactions?.includes('heart') ? 'text-red-600' : ''}`}
                      >
                        <Heart className="w-4 h-4" />
                        {announcement.reactions?.heart || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'clap')}
                        className={`${getReactionColor('clap')} ${announcement.userReactions?.includes('clap') ? 'text-yellow-600' : ''}`}
                      >
                        <Star className="w-4 h-4" />
                        {announcement.reactions?.clap || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(announcement.id, 'smile')}
                        className={`${getReactionColor('smile')} ${announcement.userReactions?.includes('smile') ? 'text-green-600' : ''}`}
                      >
                        <Smile className="w-4 h-4" />
                        {announcement.reactions?.smile || 0}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
} 