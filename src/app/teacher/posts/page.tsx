'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare, 
  User,
  Calendar,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface Post {
  id: string
  content: string
  created_at: string
  teacher_id: string
  post_type: 'student_post' | 'announcement'
  students?: {
    id: string
    name: string
  }[]
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
}

interface Student {
  id: string
  name: string
  class_id: string
  class?: {
    id: string
    name: string
  }
}

export default function TeacherPostsPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostType, setNewPostType] = useState<'student_post' | 'announcement'>('student_post')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [editPostContent, setEditPostContent] = useState('')
  const [editPostType, setEditPostType] = useState<'student_post' | 'announcement'>('student_post')
  const [editSelectedStudents, setEditSelectedStudents] = useState<string[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [reactors, setReactors] = useState<{ id: string; name: string; email: string }[]>([])
  const [reactorsLoading, setReactorsLoading] = useState(false)
  const [showReactorsDialog, setShowReactorsDialog] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState<string>('')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

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
      console.log('Fetching posts for teacher:', user.id)

      // First, get all posts created by this teacher
      const { data: allPostsData, error: allPostsError } = await supabase
        .from('posts')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (allPostsError) {
        console.error('Error fetching all posts:', allPostsError)
        toast.error('Error fetching posts')
        return
      }

      if (!allPostsData || allPostsData.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }

      // Get all post IDs that are tagged with students
      const { data: studentTaggedPosts, error: studentTagsError } = await supabase
        .from('post_student_tags')
        .select('post_id')
        .in('post_id', allPostsData.map(post => post.id))

      if (studentTagsError) {
        console.error('Error fetching student tagged posts:', studentTagsError)
        toast.error('Error fetching posts')
        return
      }

      // Get unique post IDs that are tagged with students
      const studentTaggedPostIds = [...new Set((studentTaggedPosts || []).map(tag => tag.post_id))]

      // Filter posts to only include those tagged with students
      const studentPosts = allPostsData.filter(post => studentTaggedPostIds.includes(post.id))

      if (studentPosts.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }

      // Fetch student tags for each post
      const postsWithStudents = await Promise.all(
        studentPosts.map(async (post) => {
          const { data: tagData, error: tagError } = await supabase
            .from('post_student_tags')
            .select(`
              student_id,
              students (
                id,
                name
              )
            `)
            .eq('post_id', post.id)

          if (tagError) {
            console.error('Error fetching student tags for post:', post.id, tagError)
            return { ...post, students: [] }
          }

          const students = tagData?.map((tag: any) => tag.students) || []
          
          // Fetch reactions for this post
          const { data: reactionCounts, error: reactionCountsError } = await supabase
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', post.id)
          
          const reactions = { thumbs_up: 0, heart: 0, clap: 0, smile: 0 }
          if (!reactionCountsError && reactionCounts) {
            reactionCounts.forEach((reaction: any) => {
              if (reactions.hasOwnProperty(reaction.reaction_type)) {
                reactions[reaction.reaction_type as keyof typeof reactions]++
              }
            })
          }
          
          return { ...post, students, reactions }
        })
      )

      setPosts(postsWithStudents)

    } catch (error) {
      console.error('Error fetching posts:', error)
      toast.error('Error fetching posts')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    if (!user) return

    try {
      setStudentsLoading(true)
      // First, get the teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user.id)

      if (classesError) {
        console.error('Error fetching classes:', classesError)
        toast.error('Error loading classes')
        return
      }

      const classIds = classesData?.map(c => c.id) || []

      if (classIds.length === 0) {
        setStudents([])
        return
      }

      // Then get all students in this teacher's classes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          class_id,
          classes (
            id,
            name
          )
        `)
        .in('class_id', classIds)

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        toast.error('Error loading students')
        return
      }

      setStudents(studentsData || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Error loading students')
    } finally {
      setStudentsLoading(false)
    }
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      toast.error('Please enter post content')
      return
    }

    if (newPostType === 'student_post' && selectedStudents.length === 0) {
      toast.error('Please select at least one student for student posts')
      return
    }

    try {
      // Create the post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          content: newPostContent.trim(),
          teacher_id: user?.id,
          post_type: newPostType
        })
        .select()
        .single()

      if (postError) {
        console.error('Error creating post:', postError)
        toast.error('Error creating post')
        return
      }

      // Create student tags for the post
      const studentTags = selectedStudents.map(studentId => ({
        post_id: postData.id,
        student_id: studentId
      }))

      const { error: tagsError } = await supabase
        .from('post_student_tags')
        .insert(studentTags)

      if (tagsError) {
        console.error('Error creating student tags:', tagsError)
        toast.error('Error creating student tags')
        return
      }

      setIsCreateDialogOpen(false)
      setNewPostContent('')
      setSelectedStudents([])
      await fetchPosts()
      toast.success('Post created successfully!')
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Error creating post')
    }
  }

  const handleEditPost = async () => {
    if (!editingPost) return

    if (!editPostContent.trim()) {
      toast.error('Please enter post content')
      return
    }

    if (editPostType === 'student_post' && editSelectedStudents.length === 0) {
      toast.error('Please select at least one student for student posts')
      return
    }

    try {
      // Update the post
      const { error: postError } = await supabase
        .from('posts')
        .update({
          content: editPostContent.trim(),
          post_type: editPostType
        })
        .eq('id', editingPost.id)

      if (postError) {
        console.error('Error updating post:', postError)
        toast.error('Error updating post')
        return
      }

      // Delete existing student tags
      const { error: deleteTagsError } = await supabase
        .from('post_student_tags')
        .delete()
        .eq('post_id', editingPost.id)

      if (deleteTagsError) {
        console.error('Error deleting existing tags:', deleteTagsError)
        toast.error('Error updating student tags')
        return
      }

      // Create new student tags
      const studentTags = editSelectedStudents.map(studentId => ({
        post_id: editingPost.id,
        student_id: studentId
      }))

      const { error: tagsError } = await supabase
        .from('post_student_tags')
        .insert(studentTags)

      if (tagsError) {
        console.error('Error creating new student tags:', tagsError)
        toast.error('Error updating student tags')
        return
      }

      setIsEditDialogOpen(false)
      setEditingPost(null)
      setEditPostContent('')
      setEditSelectedStudents([])
      await fetchPosts()
      toast.success('Post updated successfully!')
    } catch (error) {
      console.error('Error updating post:', error)
      toast.error('Error updating post')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return
    }

    try {
      // Delete student tags first
      const { error: tagsError } = await supabase
        .from('post_student_tags')
        .delete()
        .eq('post_id', postId)

      if (tagsError) {
        console.error('Error deleting student tags:', tagsError)
        toast.error('Error deleting post tags')
        return
      }

      // Delete the post
      const { error: postError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)

      if (postError) {
        console.error('Error deleting post:', postError)
        toast.error('Error deleting post')
        return
      }

      await fetchPosts()
      toast.success('Post deleted successfully!')
    } catch (error) {
      console.error('Error deleting post:', error)
      toast.error('Error deleting post')
    }
  }

  const openEditDialog = async (post: Post) => {
    setEditingPost(post)
    setEditPostContent(post.content)
    setEditPostType(post.post_type)
    setEditSelectedStudents(post.students?.map(s => s.id) || [])
    setIsEditDialogOpen(true)
    await fetchStudents()
  }

  // Fetch reactors for a post and reaction type
  const fetchReactors = async (postId: string, reactionType: string) => {
    setReactorsLoading(true)
    setReactors([])
    setSelectedReaction(reactionType)
    setShowReactorsDialog(true)
    setSelectedPost(posts.find(p => p.id === postId) || null)
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('parent_id, parents(name, email)')
        .eq('post_id', postId)
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

  // Helper for reaction icons
  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return <span title="Thumbs Up" role="img">👍</span>
      case 'heart':
        return <span title="Heart" role="img">❤️</span>
      case 'clap':
        return <span title="Clap" role="img">👏</span>
      case 'smile':
        return <span title="Smile" role="img">😊</span>
      default:
        return <span>👍</span>
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading posts...</p>
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
                Student Posts
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage posts tagged with specific students
              </p>
            </div>
          </div>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Student Posts Yet</h3>
                <p className="text-gray-600">
                  Create posts tagged with specific students to share updates with their parents.
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
                          <span className="text-sm font-medium text-blue-600">
                            You
                          </span>
                          <Badge variant={post.post_type === 'announcement' ? 'default' : 'secondary'} className="text-xs">
                            {post.post_type === 'announcement' ? 'Announcement' : 'Student Post'}
                          </Badge>
                          {post.students && post.students.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {post.students.map((student) => (
                                <Badge key={student.id} variant="outline" className="text-xs">
                                  {student.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <CardDescription className="flex items-center space-x-2 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(post.created_at).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(post)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Post
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Post
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                  {post.reactions && (
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-3">
                      {post.reactions.thumbs_up > 0 && (
                        <button
                          type="button"
                          className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                          onClick={() => fetchReactors(post.id, 'thumbs_up')}
                          title="See who reacted"
                        >
                          {getReactionIcon('thumbs_up')}
                          <span>{post.reactions.thumbs_up}</span>
                        </button>
                      )}
                      {post.reactions.heart > 0 && (
                        <button
                          type="button"
                          className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                          onClick={() => fetchReactors(post.id, 'heart')}
                          title="See who reacted"
                        >
                          {getReactionIcon('heart')}
                          <span>{post.reactions.heart}</span>
                        </button>
                      )}
                      {post.reactions.clap > 0 && (
                        <button
                          type="button"
                          className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                          onClick={() => fetchReactors(post.id, 'clap')}
                          title="See who reacted"
                        >
                          {getReactionIcon('clap')}
                          <span>{post.reactions.clap}</span>
                        </button>
                      )}
                      {post.reactions.smile > 0 && (
                        <button
                          type="button"
                          className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                          onClick={() => fetchReactors(post.id, 'smile')}
                          title="See who reacted"
                        >
                          {getReactionIcon('smile')}
                          <span>{post.reactions.smile}</span>
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Post Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>
                Update your post content and student selection
              </DialogDescription>
            </DialogHeader>
            {editingPost && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Post Type</Label>
                  <Select value={editPostType} onValueChange={(value: 'student_post' | 'announcement') => setEditPostType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select post type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student_post">Student Post</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPostContent">Post Content</Label>
                  <Textarea
                    id="editPostContent"
                    value={editPostContent}
                    onChange={(e) => setEditPostContent(e.target.value)}
                    placeholder="Write your post content here..."
                    rows={4}
                  />
                </div>
                {editPostType === 'student_post' && (
                  <div className="space-y-2">
                    <Label>Select Students</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {studentsLoading ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="text-sm text-gray-600 mt-2">Loading students...</p>
                        </div>
                      ) : students.length === 0 ? (
                        <p className="text-sm text-gray-500">No students found in your classes.</p>
                      ) : (
                        students.map((student) => (
                          <label key={student.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editSelectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditSelectedStudents([...editSelectedStudents, student.id])
                                } else {
                                  setEditSelectedStudents(editSelectedStudents.filter(id => id !== student.id))
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {student.name} ({student.class?.name})
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <Button onClick={handleEditPost} className="w-full">
                  Update Post
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reactors Dialog */}
        <Dialog open={showReactorsDialog} onOpenChange={setShowReactorsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedReaction && selectedPost ? (
                  <span>
                    Reactors for <span className="font-semibold">{selectedReaction.replace('_', ' ')}</span> on post:<br />
                    <span className="text-xs text-gray-500">{selectedPost.content.slice(0, 60)}{selectedPost.content.length > 60 ? '...' : ''}</span>
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
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{parent.name}</span>
                    {parent.email && <span className="text-gray-500 text-xs">({parent.email})</span>}
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
} 