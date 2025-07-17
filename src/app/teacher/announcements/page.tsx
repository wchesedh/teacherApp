'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MessageSquare, ThumbsUp, Heart, Star, Smile, Users, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { toast } from 'sonner'

interface ClassAnnouncement {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
  class?: Class
  image_url?: string
  file_url?: string
  file_name?: string
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
}

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [showReactorsDialog, setShowReactorsDialog] = useState(false)
  const [reactors, setReactors] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [reactorsLoading, setReactorsLoading] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<ClassAnnouncement | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<ClassAnnouncement | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user) {
      fetchAnnouncements()
    }
  }, [user])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      
      // Get teacher's class IDs
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user?.id)

      if (classesError) {
        console.error('Error fetching teacher classes:', classesError)
        return
      }

      const classIds = classesData?.map(c => c.id) || []
      
      if (classIds.length === 0) {
        setAnnouncements([])
        return
      }

      // Fetch class announcements (posts with class_id)
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

      // Transform announcements data and fetch reactions
      const announcementsWithReactions = await Promise.all(
        (announcementsData || []).map(async (item: any) => {
          // Get reaction counts for this announcement
          const { data: reactionCounts, error: reactionCountsError } = await supabase
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', item.id)

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

          return {
            id: item.id,
            content: item.content,
            created_at: item.created_at,
            teacher: item.teachers,
            class: item.classes,
            image_url: item.image_url,
            file_url: item.file_url,
            file_name: item.file_name,
            reactions,
            userReactions: []  // Teachers don't react to their own posts
          }
        })
      )

      setAnnouncements(announcementsWithReactions)
    } catch (error) {
      console.error('Error fetching announcements:', error)
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const fetchReactors = async (announcementId: string, reactionType: string) => {
    setReactorsLoading(true)
    setReactors([])
    setSelectedReaction(reactionType)
    setShowReactorsDialog(true)
    setSelectedAnnouncement(announcements.find(a => a.id === announcementId) || null)
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('parent_id, parents(name, email, created_at)')
        .eq('post_id', announcementId)
        .eq('reaction_type', reactionType)
      if (error) {
        toast.error('Error fetching reactors')
        setReactors([])
      } else {
        setReactors((data || []).map((r: any) => {
          const parent = Array.isArray(r.parents) ? r.parents[0] : r.parents
          return {
            id: r.parent_id,
            name: parent?.name || 'Unknown',
            email: parent?.email || ''
          }
        }))
      }
    } catch (e) {
      toast.error('Error fetching reactors')
      setReactors([])
    } finally {
      setReactorsLoading(false)
    }
  }

  const handleEdit = (announcement: ClassAnnouncement) => {
    setEditingAnnouncement(announcement)
    setEditContent(announcement.content)
    setShowEditDialog(true)
  }

  const handleDelete = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
      return
    }

    // Mark as deleting for visual feedback
    setDeletingIds(prev => new Set(prev).add(announcementId))

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', announcementId)

      if (error) {
        console.error('Error deleting announcement:', error)
        toast.error('Error deleting announcement: ' + error.message)
        // Remove from deleting state
        setDeletingIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(announcementId)
          return newSet
        })
        return
      }

      // Optimistic update - remove from UI with animation
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== announcementId))
      toast.success('Announcement deleted successfully!')
    } catch (error) {
      console.error('Error deleting announcement:', error)
      toast.error('Error deleting announcement')
      // Remove from deleting state
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(announcementId)
        return newSet
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!editingAnnouncement || !editContent.trim()) {
      toast.error('Please enter announcement content')
      return
    }

    setEditLoading(true)
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent.trim() })
        .eq('id', editingAnnouncement.id)

      if (error) {
        console.error('Error updating announcement:', error)
        toast.error('Error updating announcement: ' + error.message)
        return
      }

      toast.success('Announcement updated successfully!')
      setShowEditDialog(false)
      setEditingAnnouncement(null)
      setEditContent('')
      fetchAnnouncements() // Refresh the list
    } catch (error) {
      console.error('Error updating announcement:', error)
      toast.error('Error updating announcement')
    } finally {
      setEditLoading(false)
    }
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">
            All Announcements
          </h1>
          <p className="text-gray-600 mt-2">
            View all announcements from your classes
          </p>
        </div>

        {/* Announcements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Class Announcements ({announcements.length})</span>
            </CardTitle>
            <CardDescription>
              All announcements from your classes with parent reactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Announcements Yet</h3>
                <p className="text-gray-600">
                  Create announcements in your classes to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className={`border rounded-lg p-4 transition-all duration-300 ease-in-out ${
                      deletingIds.has(announcement.id) 
                        ? 'opacity-50 scale-95 bg-gray-50' 
                        : 'opacity-100 scale-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {announcement.class && (
                          <span className="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded">
                            {announcement.class.name}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            disabled={deletingIds.has(announcement.id)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleEdit(announcement)}
                            disabled={deletingIds.has(announcement.id)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-600 focus:text-red-600"
                            disabled={deletingIds.has(announcement.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap text-sm mb-3">{announcement.content}</p>
                    
                    {/* Display image if present */}
                    {announcement.image_url && (
                      <div className="mt-3">
                        <img 
                          src={announcement.image_url} 
                          alt="Announcement attachment" 
                          className="max-w-full h-auto rounded-lg border" 
                          style={{ maxHeight: 400 }} 
                        />
                      </div>
                    )}
                    
                    {/* Display file attachment if present */}
                    {announcement.file_url && !announcement.image_url && (
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
                            className="text-blue-600 underline hover:text-blue-800"
                          >
                            📎 {announcement.file_name || 'Download attachment'}
                          </a>
                        </div>
                      )
                    )}
                    
                    {/* Reaction counts (read-only for teachers) */}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-3">
                      {announcement.reactions && (
                        <>
                          {announcement.reactions.thumbs_up > 0 && (
                            <button
                              type="button"
                              className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                              onClick={() => fetchReactors(announcement.id, 'thumbs_up')}
                              title="See who reacted"
                            >
                              <ThumbsUp className="w-4 h-4 text-blue-600" />
                              <span>{announcement.reactions.thumbs_up}</span>
                            </button>
                          )}
                          {announcement.reactions.heart > 0 && (
                            <button
                              type="button"
                              className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                              onClick={() => fetchReactors(announcement.id, 'heart')}
                              title="See who reacted"
                            >
                              <Heart className="w-4 h-4 text-red-600" />
                              <span>{announcement.reactions.heart}</span>
                            </button>
                          )}
                          {announcement.reactions.clap > 0 && (
                            <button
                              type="button"
                              className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                              onClick={() => fetchReactors(announcement.id, 'clap')}
                              title="See who reacted"
                            >
                              <Star className="w-4 h-4 text-yellow-600" />
                              <span>{announcement.reactions.clap}</span>
                            </button>
                          )}
                          {announcement.reactions.smile > 0 && (
                            <button
                              type="button"
                              className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                              onClick={() => fetchReactors(announcement.id, 'smile')}
                              title="See who reacted"
                            >
                              <Smile className="w-4 h-4 text-green-600" />
                              <span>{announcement.reactions.smile}</span>
                            </button>
                          )}
                        </>
                      )}
                      {(!announcement.reactions || 
                        (announcement.reactions.thumbs_up === 0 && 
                         announcement.reactions.heart === 0 && 
                         announcement.reactions.clap === 0 && 
                         announcement.reactions.smile === 0)) && (
                        <span className="text-gray-400">No reactions yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reactors Dialog */}
        <Dialog open={showReactorsDialog} onOpenChange={setShowReactorsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedReaction && selectedAnnouncement ? (
                  <span>
                    Reactors for <span className="font-semibold">{selectedReaction.replace('_', ' ')}</span> on announcement:<br />
                    <span className="text-xs text-gray-500">{selectedAnnouncement.content.slice(0, 60)}{selectedAnnouncement.content.length > 60 ? '...' : ''}</span>
                  </span>
                ) : 'Reactors'}
              </DialogTitle>
            </DialogHeader>
            {reactorsLoading ? (
              <div className="py-4 text-center">Loading...</div>
            ) : reactors.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No parents have reacted with this emoji yet.</div>
            ) : (
              <ul className="space-y-2 py-2">
                {reactors.map((parent) => (
                  <li key={parent.id} className="flex items-center space-x-3">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{parent.name}</span>
                    {parent.email && <span className="text-gray-500 text-xs">({parent.email})</span>}
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Announcement Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
              <DialogDescription>
                Update the content of your announcement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Enter announcement content..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingAnnouncement(null)
                    setEditContent('')
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveEdit}
                  disabled={editLoading || !editContent.trim()}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
} 