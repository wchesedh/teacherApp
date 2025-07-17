'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  GraduationCap, 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  ArrowLeft,
  BookOpen,
  ThumbsUp,
  Heart,
  Star,
  Smile
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  class_id: string
  created_at: string
  parents?: Parent[]
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at: string
}

interface Class {
  id: string
  name: string
  teacher_id: string
}

interface Post {
  id: string
  content: string
  created_at: string
  image_url?: string
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
}

export default function StudentProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const studentId = params.id as string
  
  const [student, setStudent] = useState<Student | null>(null)
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false)
  // Add state for reactors dialog:
  const [showReactorsDialog, setShowReactorsDialog] = useState(false);
  const [reactors, setReactors] = useState<any[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (studentId) {
      fetchStudentDetails()
    }
  }, [studentId])

  const fetchStudentDetails = async () => {
    try {
      setLoading(true)

      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) {
        console.error('Error fetching student:', studentError)
        toast.error('Error fetching student details')
        return
      }

      // Verify this student belongs to one of the teacher's classes
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', studentData.class_id)
        .eq('teacher_id', user?.id)
        .single()

      if (classError || !classData) {
        toast.error('You can only view students from your own classes')
        return
      }

      setClassInfo(classData)

      // Fetch student's parents
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('parent_id')
        .eq('student_id', studentId)

      if (studentParentsError) {
        console.error('Error fetching student parents:', studentParentsError)
      } else {
        const parentIds = studentParentsData?.map(sp => sp.parent_id) || []
        
        if (parentIds.length > 0) {
          const { data: parentsData, error: parentsError } = await supabase
            .from('parents')
            .select('*')
            .in('id', parentIds)

          if (parentsError) {
            console.error('Error fetching parents:', parentsError)
          } else {
            setStudent({ ...studentData, parents: parentsData || [] })
          }
        } else {
          setStudent({ ...studentData, parents: [] })
        }
      }

      // First, let's check if the post_student_tags table exists and has data
      console.log('Fetching posts for student:', studentId)
      console.log('Current user ID:', user?.id)
      
      // Try a simpler approach - first get the post IDs for this student
      const { data: tagData, error: tagError } = await supabase
        .from('post_student_tags')
        .select('post_id')
        .eq('student_id', studentId)

      console.log('Tag data:', tagData)
      console.log('Tag error:', tagError)

      if (tagError) {
        console.error('Error fetching post tags:', tagError)
        setPosts([])
      } else if (tagData && tagData.length > 0) {
        // Get the post IDs
        const postIds = tagData.map(tag => tag.post_id)
        
        // Fetch the actual posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .in('id', postIds)
          .eq('teacher_id', user?.id)
          .order('created_at', { ascending: false })

        console.log('Posts data:', postsData)
        console.log('Posts error:', postsError)

        if (postsError) {
          console.error('Error fetching posts:', postsError)
          setPosts([])
        } else {
          // Fetch reactions for each post
          const postsWithReactions = await Promise.all(
            (postsData || []).map(async (post) => {
              const { data: reactionCounts, error: reactionCountsError } = await supabase
                .from('post_reactions')
                .select('reaction_type')
                .eq('post_id', post.id)
              
              const reactions = { thumbs_up: 0, heart: 0, clap: 0, smile:0 }
              if (!reactionCountsError && reactionCounts) {
                reactionCounts.forEach((reaction: any) => {
                  if (reactions.hasOwnProperty(reaction.reaction_type)) {
                    reactions[reaction.reaction_type as keyof typeof reactions]++
                  }
                })
              }
              
              return {
                ...post,
                reactions
              }
            })
          )
          setPosts(postsWithReactions)
        }
      } else {
        // No posts found for this student
        setPosts([])
      }

    } catch (error) {
      console.error('Error fetching student details:', error)
      toast.error('Error fetching student details')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = async (postData: { content: string; image_url?: string }) => {
    try {
      // First, create the post
      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert([{
          content: postData.content,
          teacher_id: user?.id,
          image_url: postData.image_url
        }])
        .select()

      if (postError) {
        console.error('Error creating post:', postError)
        toast.error('Error creating post: ' + postError.message)
        return
      }

      if (!createdPost || createdPost.length === 0) {
        toast.error('Error creating post: No post data returned')
        return
      }

      const postId = createdPost[0].id

      // Then, create the post-student tag
      const { error: tagError } = await supabase
        .from('post_student_tags')
        .insert([{
          post_id: postId,
          student_id: studentId
        }])

      if (tagError) {
        console.error('Error creating post-student tag:', tagError)
        toast.error('Error linking post to student: ' + tagError.message)
        return
      }

      setIsCreatePostOpen(false)
      await fetchStudentDetails() // Refresh posts
      toast.success('Post created successfully!')
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Error creating post')
    }
  }

  // Add function to fetch reactors:
  const fetchReactors = async (postId: string, reactionType: string) => {
    setReactorsLoading(true);
    setReactors([]);
    setSelectedReaction(reactionType);
    setShowReactorsDialog(true);
    setSelectedPost(posts.find(p => p.id === postId) || null);
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('parent_id, parents(name, email)')
        .eq('post_id', postId)
        .eq('reaction_type', reactionType);
      if (error) {
        toast.error('Error fetching reactors');
        setReactors([]);
      } else {
        setReactors((data || []).map((r: any) => ({
          id: r.parent_id,
          name: r.parents?.name || 'Unknown',
          email: r.parents?.email || ''
        })));
      }
    } catch (e) {
      toast.error('Error fetching reactors');
      setReactors([]);
    } finally {
      setReactorsLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading student details...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!student) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Student not found</p>
            <Link href="/" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to Dashboard
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
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {student.name}'s Profile
              </h1>
              <p className="text-gray-600 mt-2">
                Student details and progress updates
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5" />
                  <span>Student Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{student.name}</h3>
                    <p className="text-sm text-gray-600">Student</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Class:</span>
                    <span className="text-sm font-medium">{classInfo?.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Joined:</span>
                    <span className="text-sm font-medium">
                      {new Date(student.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parents Info */}
            {student.parents && student.parents.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Parents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {student.parents.map((parent) => (
                      <div key={parent.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{parent.name}</p>
                          {parent.email && (
                            <div className="flex items-center space-x-1 text-sm text-gray-600">
                              <Mail className="w-3 h-3" />
                              <span>{parent.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Posts Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="w-5 h-5" />
                      <span>Progress Updates</span>
                    </CardTitle>
                    <CardDescription>
                      Posts about {student.name}'s progress
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsCreatePostOpen(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Create Post
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {posts.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Posts Yet</h3>
                    <p className="text-gray-600 mb-4">
                      Start sharing updates about {student.name}'s progress with their parents.
                    </p>
                    <Button onClick={() => setIsCreatePostOpen(true)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Create First Post
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600 whitespace-pre-wrap mb-3">{post.content}</p>
                        {post.image_url && (
                          <div className="mt-3">
                            <img 
                              src={post.image_url} 
                              alt="Post image" 
                              className="max-w-full h-auto rounded-lg border"
                              style={{ maxHeight: '400px' }}
                            />
                          </div>
                        )}
                        {post.reactions && (
                          <div className="flex items-center mt-3 space-x-4 text-sm text-gray-500">
                            {post.reactions.thumbs_up > 0 && (
                              <button
                                type="button"
                                className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                                onClick={() => fetchReactors(post.id, 'thumbs_up')}
                                title="See who reacted"
                              >
                                <ThumbsUp className="w-4 h-4 text-blue-600" />
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
                                <Heart className="w-4 h-4 text-red-600" />
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
                                <Star className="w-4 h-4 text-yellow-600" />
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
                                <Smile className="w-4 h-4 text-green-600" />
                                <span>{post.reactions.smile}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Create Post Dialog */}
        <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Post About {student.name}</DialogTitle>
              <DialogDescription>
                Share updates about {student.name}'s progress with their parents
              </DialogDescription>
            </DialogHeader>
            <CreatePostForm 
              onSubmit={handleCreatePost}
              studentName={student.name}
            />
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
                    <span className="text-xs text-gray-500">{selectedPost.content.length > 60 ? selectedPost.content.slice(0, 60) + '...' : selectedPost.content}</span>
                  </span>
                ) : 'Reactors'}
              </DialogTitle>
            </DialogHeader>
            {reactorsLoading ? (
              <div className="py-4 text-center">Loading...</div>
            ) : reactors.length === 0 ? (
              <div className="py-4 text-center text-gray-500">No parents have reacted with this emoji yet.</div>
            ) : (
              <ul className="space-y-2">
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

// Create Post Form Component
function CreatePostForm({ 
  onSubmit, 
  studentName 
}: { 
  onSubmit: (data: { content: string; image_url?: string }) => void
  studentName: string
}) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `student-posts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('student-posts')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        toast.error('Error uploading image')
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('student-posts')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Error uploading image')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0]
      if (file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image size must be less than 5MB')
          return
        }
        setImageFile(file)
        const reader = new FileReader()
        reader.onload = (ev) => {
          setImagePreview(ev.target?.result as string)
        }
        reader.readAsDataURL(file)
        e.preventDefault()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Please fill in the content')
      return
    }

    setLoading(true)
    let imageUrl: string | undefined

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile)
      if (!uploadedUrl) {
        setLoading(false)
        return
      }
      imageUrl = uploadedUrl
    }

    await onSubmit({ 
      content: content.trim(),
      image_url: imageUrl
    })
    setContent('')
    setImageFile(null)
    setImagePreview(null)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="postContent">Content *</Label>
        <textarea
          id="postContent"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          placeholder={`Share updates about ${studentName}'s progress...`}
          rows={4}
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="postImage">Image (optional)</Label>
        <input
          id="postImage"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500">Max size: 5MB. Supported formats: JPG, PNG, GIF</p>
      </div>

      {imagePreview && (
        <div className="space-y-2">
          <Label>Image Preview</Label>
          <div className="relative inline-block">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="max-w-full h-auto rounded-lg border"
              style={{ maxHeight: '200px' }}
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button 
          type="submit" 
          disabled={loading || uploading}
          className="min-w-[120px]"
        >
          {loading ? 'Creating...' : uploading ? 'Uploading...' : 'Create Post'}
        </Button>
      </div>
    </form>
  )
} 