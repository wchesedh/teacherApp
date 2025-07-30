'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useActivePeriod } from '@/contexts/ActivePeriodContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MessageSquare, ThumbsUp, Heart, Star, Smile, Users, MoreVertical, Edit, Trash2, Plus, Camera } from 'lucide-react'
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
  academic_period?: AcademicPeriod
}

interface AcademicPeriod {
  id: string
  name: string
  type: string
  start_date: string
  end_date: string
  school_year: string
}

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth()
  const { activePeriod } = useActivePeriod()
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
  
  // Advanced edit state for multiple images
  const [editFiles, setEditFiles] = useState<File[]>([])
  const [editFilePreviews, setEditFilePreviews] = useState<string[]>([])
  const [keepExistingFiles, setKeepExistingFiles] = useState(true)
  const [removedExistingIndices, setRemovedExistingIndices] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (user && activePeriod) {
      fetchAnnouncements()
    }
  }, [user, activePeriod])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      
      // Get teacher's class IDs in the active academic period
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user?.id)
        .eq('academic_period_id', activePeriod?.id)

      if (classesError) {
        console.error('Error fetching teacher classes:', classesError)
        return
      }

      const classIds = classesData?.map(c => c.id) || []
      
      if (classIds.length === 0) {
        setAnnouncements([])
        return
      }

      // Fetch class announcements (posts with class_id) with academic period info
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
            name,
            academic_periods (
              id,
              name,
              type,
              start_date,
              end_date,
              school_year
            )
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
              class: {
                ...item.classes,
                academic_period: item.classes.academic_periods
              },
              image_url: item.image_url,
              file_url: item.file_url,
              file_name: item.file_name,
              file_urls: item.file_urls,
              file_names: item.file_names,
              reactions,
              userReactions: []
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

      if (announcementsError) {
        console.error('Error fetching class announcements:', announcementsError)
        setAnnouncements([])
        return
      }

      // Transform announcements data and fetch reactions
      const announcementsWithReactions = await Promise.all(
        (classAnnouncementsOnly || []).map(async (item: any) => {
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
            class: {
              ...item.classes,
              academic_period: item.classes.academic_periods
            },
            image_url: item.image_url,
            file_url: item.file_url,
            file_name: item.file_name,
            file_urls: item.file_urls,
            file_names: item.file_names,
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
    setEditFiles([])
    setEditFilePreviews([])
    setKeepExistingFiles(true)
    setRemovedExistingIndices(new Set())
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

  // Helper functions for file handling
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 2MB. Please choose a smaller file.`);
        return false;
      }
      return true;
    });

    // Calculate total count: existing files (if keeping them, excluding removed ones) + current new files + new files being added
    const existingCount = keepExistingFiles && editingAnnouncement?.file_urls ? 
      (editingAnnouncement.file_urls.filter((_, index) => !removedExistingIndices.has(index)).length || 0) : 0;
    const currentNewCount = editFiles.length;
    const totalCount = existingCount + currentNewCount + validFiles.length;
    
    if (totalCount > 5) {
      toast.error("You can only upload up to 5 images total. Please remove some files first.");
      return;
    }

    setEditFiles(prev => [...prev, ...validFiles]);
    
    // Generate previews for new images
    validFiles.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setEditFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setEditFilePreviews(prev => [...prev, '']);
      }
    });
  };

  const removeEditFile = (index: number) => {
    setEditFiles(prev => prev.filter((_, i) => i !== index));
    setEditFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (index: number) => {
    setRemovedExistingIndices(prev => new Set([...prev, index]));
  };

  const restoreExistingFile = (index: number) => {
    setRemovedExistingIndices(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File): Promise<{ url: string, name: string } | null> => {
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = fileName;
      const { error } = await supabase.storage.from('class-announcements').upload(filePath, file);
      if (error) {
        toast.error('Error uploading file: ' + (error.message || JSON.stringify(error)));
        return null;
      }
      const { data } = supabase.storage.from('class-announcements').getPublicUrl(filePath);
      return { url: data.publicUrl, name: file.name };
    } catch (err: any) {
      toast.error('Error uploading file: ' + (err.message || JSON.stringify(err)));
      return null;
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAnnouncement || !editContent.trim()) {
      toast.error('Please enter announcement content')
      return
    }

    setEditLoading(true)
    try {
      let file_urls: string[] = [];
      let file_names: string[] = [];
      
      // Start with existing files if we're keeping them (excluding removed ones)
      if (keepExistingFiles && editingAnnouncement.file_urls && editingAnnouncement.file_urls.length > 0) {
        file_urls = editingAnnouncement.file_urls.filter((_, index) => !removedExistingIndices.has(index));
        file_names = (editingAnnouncement.file_names || []).filter((_, index) => !removedExistingIndices.has(index));
      }
      
      // Upload new files and add them to the existing ones
      if (editFiles.length > 0) {
        const uploadPromises = editFiles.map(file => uploadFile(file));
        const uploadResults = await Promise.all(uploadPromises);
        
        const failedUploads = uploadResults.filter(result => result === null);
        if (failedUploads.length > 0) {
          setEditLoading(false);
          return;
        }
        
        // Add new files to existing ones (don't overwrite)
        file_urls = [...file_urls, ...uploadResults.map(result => result!.url)];
        file_names = [...file_names, ...uploadResults.map(result => result!.name)];
      }

      const { error } = await supabase
        .from('posts')
        .update({ 
          content: editContent.trim(),
          file_urls: file_urls.length > 0 ? file_urls : null,
          file_names: file_names.length > 0 ? file_names : null
        })
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
      setEditFiles([])
      setEditFilePreviews([])
      setKeepExistingFiles(true)
      setRemovedExistingIndices(new Set())
      fetchAnnouncements() // Refresh the list
    } catch (error) {
      console.error('Error updating announcement:', error)
      toast.error('Error updating announcement')
    } finally {
      setEditLoading(false)
    }
  }

  if (!activePeriod) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading academic period...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
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
                        {announcement.class?.academic_period && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                            📅 {announcement.class.academic_period.name}
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(announcement.created_at).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
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
                    
                    {/* Display multiple images if present */}
                    {announcement.file_urls && announcement.file_urls.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
              <DialogDescription>
                Update the content and images of your announcement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-content">Announcement Content</Label>
                <textarea
                  id="edit-content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Enter announcement content..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-file">Attach Images (up to 5, max 2MB each)</Label>
                <input
                  id="edit-file"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                
                {editingAnnouncement?.file_urls && editingAnnouncement.file_urls.length > 0 && keepExistingFiles && (
                  <div className="mt-2 p-2 bg-gray-50 rounded border">
                    <p className="text-sm text-gray-600 mb-2">Current attachments:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {editingAnnouncement.file_urls.map((url, index) => {
                        const isRemoved = removedExistingIndices.has(index);
                        return (
                          <div key={index} className={`relative ${isRemoved ? 'opacity-50' : ''}`}>
                            <img 
                              src={url} 
                              alt={`Current attachment ${index + 1}`} 
                              className={`w-full h-24 object-cover rounded border ${isRemoved ? 'grayscale' : ''}`} 
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className={`absolute top-1 right-1 h-6 w-6 p-0 ${isRemoved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                              onClick={() => isRemoved ? restoreExistingFile(index) : removeExistingFile(index)}
                            >
                              {isRemoved ? '↻' : '×'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {removedExistingIndices.size > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {removedExistingIndices.size} image(s) marked for removal
                      </p>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2" 
                      onClick={() => setKeepExistingFiles(false)}
                    >
                      Remove all current attachments
                    </Button>
                  </div>
                )}
                
                {editFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-gray-600">
                      {editFiles.length} new image(s) selected
                      {keepExistingFiles && editingAnnouncement?.file_urls && editingAnnouncement.file_urls.length > 0 && (
                        <span className="ml-2 text-blue-600">
                          (+ {editingAnnouncement.file_urls.filter((_, index) => !removedExistingIndices.has(index)).length} existing)
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {editFiles.map((file, index) => (
                        <div key={index} className="relative border rounded p-2">
                          {editFilePreviews[index] ? (
                            <img 
                              src={editFilePreviews[index]} 
                              alt={`Preview ${index + 1}`} 
                              className="w-full h-32 object-cover rounded" 
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                              <span className="text-sm text-gray-500">{file.name}</span>
                            </div>
                          )}
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 text-white hover:bg-red-600" 
                            onClick={() => removeEditFile(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingAnnouncement(null)
                    setEditContent('')
                    setEditFiles([])
                    setEditFilePreviews([])
                    setKeepExistingFiles(true)
                    setRemovedExistingIndices(new Set())
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