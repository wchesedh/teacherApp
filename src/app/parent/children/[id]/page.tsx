'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  ArrowLeft,
  BookOpen,
  Camera,
  Edit,
  Save,
  X,
  Settings,
  Users,
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
import { formatFullName, getDisplayName } from '@/lib/utils'

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
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  name: string
  id_number?: string
  class_id: string
  created_at: string
  avatar_url?: string
  bio?: string
  grade?: string
  age?: number | null
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
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  name: string
  email: string
}

interface Post {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
  userReactions?: string[]
}

export default function ParentStudentProfilePage() {
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const studentId = params.id as string
  
  const [student, setStudent] = useState<Student | null>(null)
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [stats, setStats] = useState({
    posts: 0,
    teachers: 0,
    classmates: 0
  })
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    id_number: '',
    bio: '',
    grade: '',
    age: ''
  })
  const [reactingPosts, setReactingPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (studentId && user && !authLoading) {
      fetchStudentDetails()
    }
  }, [studentId, user, authLoading])

  const fetchPostsForClass = async (classId: string | null) => {
    if (!classId || !user) {
      setPosts([])
      return
    }

    try {
      // Fetch posts for this student in the specific class
      const { data: tagData, error: tagError } = await supabase
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
              first_name,
              middle_name,
              last_name,
              suffix,
              name,
              email
            )
          )
        `)
        .eq('student_id', studentId)
        .eq('posts.class_id', classId)

      if (tagError) {
        console.error('Error fetching post tags:', tagError)
        setPosts([])
      } else if (tagData && tagData.length > 0) {
        // Transform posts data and fetch reactions
        const postsWithReactions = await Promise.all(
          tagData
            .filter((item: any) => item.posts && item.posts.id) // Filter out null posts
            .map(async (item: any) => {
              // Get reaction counts for this post
              const { data: reactionCounts, error: reactionCountsError } = await supabase
                .from('post_reactions')
                .select('reaction_type')
                .eq('post_id', item.posts.id)

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

              // Get user's reactions for this post
              const { data: userReactions, error: userReactionsError } = await supabase
                .from('post_reactions')
                .select('reaction_type')
                .eq('post_id', item.posts.id)
                .eq('parent_id', user.id)

              const userReactionTypes = userReactions?.map((r: any) => r.reaction_type) || []

              return {
                id: item.posts.id,
                content: item.posts.content,
                created_at: item.posts.created_at,
                teacher: item.posts.teachers,
                reactions,
                userReactions: userReactionTypes
              }
            })
        )
        
        setPosts(postsWithReactions)
      } else {
        setPosts([])
      }
    } catch (error) {
      console.error('Error fetching posts for class:', error)
      setPosts([])
    }
  }

  const handleClassSelection = async (classId: string) => {
    if (!user) return
    
    setSelectedClassId(classId)
    const selectedClass = studentClasses.find(c => c.id === classId)
    setClassInfo(selectedClass || null)
    await fetchPostsForClass(classId)
    if (student) {
      await fetchStudentStats(student, selectedClass || null)
    }
  }

  const fetchStudentDetails = async () => {
    try {
      setLoading(true)

      // Verify this student belongs to this parent
      const { data: studentParentData, error: studentParentError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('student_id', studentId)
        .eq('parent_id', user?.id)
        .single()

      if (studentParentError || !studentParentData) {
        toast.error('You can only view your own children')
        return
      }

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

      setStudent(studentData)
      // Parse the student name to get first and last name
      const nameParts = studentData.name?.split(' ') || []
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      setEditForm({
        first_name: firstName,
        middle_name: '',
        last_name: lastName,
        suffix: '',
        id_number: studentData.id_number || '',
        bio: studentData.bio || '',
        grade: studentData.grade || '',
        age: studentData.age?.toString() || ''
      })

      // Fetch all classes for this student
      let classData: Class | null = null
      let allClasses: Class[] = []
      
      try {
        // First try to get all classes using student_class table
        const { data: studentClassesData, error: studentClassesError } = await supabase
          .from('student_class')
          .select(`
            classes!student_class_class_id_fkey (
              id,
              name,
              teacher_id,
              teachers!classes_teacher_id_fkey (
                id,
                first_name,
                middle_name,
                last_name,
                suffix,
                name,
                email
              )
            )
          `)
          .eq('student_id', studentId)

        if (studentClassesError) {
          console.error('Error fetching student classes:', studentClassesError)
          // Fallback to single class
          if (studentData.class_id) {
            const { data: singleClassResult, error: singleClassError } = await supabase
              .from('classes')
              .select(`
                *,
                teachers (
                  id,
                  first_name,
                  middle_name,
                  last_name,
                  suffix,
                  name,
                  email
                )
              `)
              .eq('id', studentData.class_id)
              .single()

            if (singleClassError) {
              console.error('Error fetching single class:', singleClassError)
            } else {
              classData = singleClassResult
              allClasses = [singleClassResult]
              setClassInfo(singleClassResult)
            }
          }
        } else {
          allClasses = studentClassesData?.map((sc: any) => sc.classes).filter(Boolean) || []
          classData = allClasses[0] || null
          setClassInfo(classData)
        }
      } catch (error) {
        console.error('Error processing student classes:', error)
        // Fallback to single class
        if (studentData.class_id) {
          const { data: singleClassResult, error: singleClassError } = await supabase
            .from('classes')
            .select(`
              *,
              teachers (
                id,
                first_name,
                middle_name,
                last_name,
                suffix,
                name,
                email
              )
            `)
            .eq('id', studentData.class_id)
            .single()

          if (!singleClassError && singleClassResult) {
            classData = singleClassResult
            allClasses = [singleClassResult]
            setClassInfo(singleClassResult)
          }
        }
      }

      setStudentClasses(allClasses)
      setSelectedClassId(allClasses[0]?.id || null)

      // Fetch posts for this student (will be updated when class is selected)
      await fetchPostsForClass(allClasses[0]?.id || null)

      // Fetch stats after all data is loaded
      await fetchStudentStats(studentData, classData)

    } catch (error) {
      console.error('Error fetching student details:', error)
      toast.error('Error fetching student details')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudentStats = async (studentData?: Student, classData?: Class | null) => {
    const currentStudent = studentData || student
    const currentClassInfo = classData || classInfo
    
    if (!currentStudent) return

    try {
      // Count posts for this student in the specific class
      let postsCount = 0
      let postsError = null
      
      if (currentClassInfo?.id) {
        try {
          // First get all posts for this student
          const { data: studentPosts, error: postsQueryError } = await supabase
            .from('post_student_tags')
            .select(`
              posts (
                id,
                class_id
              )
            `)
            .eq('student_id', currentStudent.id)

          if (postsQueryError) {
            console.error('Error fetching student posts:', postsQueryError)
            postsCount = 0
            postsError = postsQueryError
          } else {
            // Filter posts by class_id and count them
            const classPosts = studentPosts?.filter((item: any) => 
              item.posts && item.posts.class_id === currentClassInfo.id
            ) || []
            postsCount = classPosts.length
          }
        } catch (error) {
          console.error('Error counting posts for student in class:', currentStudent.id, currentClassInfo.id, error)
          postsCount = 0
          postsError = error
        }
      } else {
        console.log('No class selected, setting posts count to 0')
      }

      // Count classmates (students in the same class)
      let classmatesCount = 0
      let classmatesError = null
      
      if (currentClassInfo?.id) {
        try {
          // Use student_class table to get all students in this class
          const { data: classStudents, error } = await supabase
            .from('student_class')
            .select(`
              student_id,
              students (
                id,
                name
              )
            `)
            .eq('class_id', currentClassInfo.id)

          if (error) {
            console.error('Error fetching classmates:', error)
            classmatesCount = 0
            classmatesError = error
          } else {
            // Count all students in this class (excluding the current student)
            const allClassStudents = classStudents?.filter((item: any) => 
              item.students && item.student_id !== currentStudent.id
            ) || []
            classmatesCount = allClassStudents.length
          }
        } catch (error) {
          console.error('Error counting classmates:', error)
          classmatesCount = 0
          classmatesError = error
        }
      } else {
        console.log('No class selected, setting classmates count to 0')
      }

      // Count teachers for this student's class
      let teachersCount = 0
      let teachersError = null
      
      if (currentClassInfo?.id) {
        const { data: classData, error } = await supabase
          .from('classes')
          .select('teacher_id')
          .eq('id', currentClassInfo.id)
          .not('teacher_id', 'is', null)
          .single()
        
        teachersCount = classData?.teacher_id ? 1 : 0
        teachersError = error
      } else {
        console.log('No class selected, setting teachers count to 0')
      }

      setStats({
        posts: postsCount || 0,
        teachers: teachersCount,
        classmates: classmatesCount || 0 // Already excludes the current student in the query
      })

      // Log any errors for debugging
      if (postsError) {
        console.error('Error fetching posts count:', postsError)
        console.error('Posts error details:', {
          studentId: currentStudent.id,
          classId: currentClassInfo?.id,
          error: postsError
        })
      }
      if (classmatesError) {
        console.error('Error fetching classmates count:', classmatesError)
        console.error('Classmates error details:', {
          studentId: currentStudent.id,
          classId: currentClassInfo?.id,
          error: classmatesError
        })
      }
      if (teachersError) {
        console.error('Error fetching teachers count:', teachersError)
        console.error('Teachers error details:', {
          studentId: currentStudent.id,
          classId: currentClassInfo?.id,
          error: teachersError
        })
      }

    } catch (error) {
      console.error('Error fetching student stats:', error)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!student) return

    try {
      setUploadingAvatar(true)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${student.id}-${Date.now()}.${fileExt}`
      const filePath = `student-avatars/${fileName}`

      console.log('Attempting to upload file:', {
        fileName,
        filePath,
        fileSize: file.size,
        fileType: file.type
      })

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          name: uploadError.name
        })
        
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          toast.error('Storage bucket not found. Please create an "avatars" bucket in Supabase Storage.')
        } else if (uploadError.message?.includes('policy') || uploadError.message?.includes('permission')) {
          toast.error('Storage permission denied. Please check storage policies.')
        } else {
          toast.error(`Error uploading avatar: ${uploadError.message}`)
        }
        return
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      console.log('Public URL:', publicUrl)

      // Update student record
      const { error: updateError } = await supabase
        .from('students')
        .update({ avatar_url: publicUrl })
        .eq('id', student.id)

      if (updateError) {
        console.error('Error updating avatar in database:', updateError)
        toast.error('Error updating avatar in database: ' + updateError.message)
        return
      }

      // Update local state
      setStudent(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      toast.success('Avatar updated successfully!')
      setShowAvatarDialog(false)

    } catch (error) {
      console.error('Unexpected error during avatar upload:', error)
      toast.error('Unexpected error uploading avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!student) return

    try {
      // Create combined name from separate fields
      const combinedName = `${editForm.first_name} ${editForm.last_name}`.trim()
      
      const { error } = await supabase
        .from('students')
        .update({
          name: combinedName,
          id_number: editForm.id_number || undefined,
          bio: editForm.bio || undefined,
          grade: editForm.grade || undefined,
          age: editForm.age ? parseInt(editForm.age) : undefined
        })
        .eq('id', student.id)

      if (error) {
        console.error('Error updating profile:', error)
        toast.error('Error updating profile')
        return
      }

      // Update local state
      setStudent(prev => prev ? {
        ...prev,
        name: combinedName,
        id_number: editForm.id_number || undefined,
        bio: editForm.bio || undefined,
        grade: editForm.grade || undefined,
        age: editForm.age ? parseInt(editForm.age) : undefined
      } : null)
      setEditMode(false)
      toast.success('Profile updated successfully!')

    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Error updating profile')
    }
  }

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!user) return

    try {
      setReactingPosts(prev => new Set(prev).add(postId))

      // Check if user already reacted with this type
      const { data: existingReaction, error: checkError } = await supabase
        .from('post_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('parent_id', user.id)
        .eq('reaction_type', reactionType)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing reaction:', checkError)
        toast.error('Error updating reaction')
        return
      }

      if (existingReaction) {
        // Remove reaction
        const { error: deleteError } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('parent_id', user.id)
          .eq('reaction_type', reactionType)

        if (deleteError) {
          console.error('Error removing reaction:', deleteError)
          toast.error('Error removing reaction')
          return
        }

        toast.success('Reaction removed')
      } else {
        // Add reaction
        const { error: insertError } = await supabase
          .from('post_reactions')
          .insert([{
            post_id: postId,
            parent_id: user.id,
            reaction_type: reactionType
          }])

        if (insertError) {
          console.error('Error adding reaction:', insertError)
          toast.error('Error adding reaction')
          return
        }

        toast.success('Reaction added')
      }

      // Refresh posts to update reaction counts
      await fetchStudentDetails()

    } catch (error) {
      console.error('Error handling reaction:', error)
      toast.error('Error updating reaction')
    } finally {
      setReactingPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
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

  const getReactionColor = (type: string, isActive: boolean) => {
    switch (type) {
      case 'thumbs_up':
        return isActive ? 'text-blue-600 bg-blue-100' : 'text-blue-600 hover:text-blue-700'
      case 'heart':
        return isActive ? 'text-red-600 bg-red-100' : 'text-red-600 hover:text-red-700'
      case 'clap':
        return isActive ? 'text-yellow-600 bg-yellow-100' : 'text-yellow-600 hover:text-yellow-700'
      case 'smile':
        return isActive ? 'text-green-600 bg-green-100' : 'text-green-600 hover:text-green-700'
      default:
        return isActive ? 'text-gray-600 bg-gray-100' : 'text-gray-600 hover:text-gray-700'
    }
  }

  if (loading || authLoading) {
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

  if (!user) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Please log in to view student details</p>
            <Link href="/auth" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Go to Login
            </Link>
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
            <Link href="/parent/children" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {student.name}'s Profile
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage your child's information
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <GraduationCap className="w-5 h-5" />
                    <span>Personal Information</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstName" className="text-sm font-medium">First Name *</Label>
                        <Input
                          id="firstName"
                          placeholder="First name"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-sm font-medium">Last Name *</Label>
                        <Input
                          id="lastName"
                          placeholder="Last name"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="middleName" className="text-sm font-medium">Middle Name</Label>
                        <Input
                          id="middleName"
                          placeholder="Middle name (optional)"
                          value={editForm.middle_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="suffix" className="text-sm font-medium">Suffix</Label>
                        <Input
                          id="suffix"
                          placeholder="Jr., Sr., III (optional)"
                          value={editForm.suffix}
                          onChange={(e) => setEditForm(prev => ({ ...prev, suffix: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="idNumber" className="text-sm font-medium">ID Number</Label>
                        <Input
                          id="idNumber"
                          placeholder="Student ID"
                          value={editForm.id_number}
                          onChange={(e) => setEditForm(prev => ({ ...prev, id_number: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="grade" className="text-sm font-medium">Grade</Label>
                        <Input
                          id="grade"
                          placeholder="Grade level"
                          value={editForm.grade}
                          onChange={(e) => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="age" className="text-sm font-medium">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          placeholder="Age"
                          value={editForm.age}
                          onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                      <textarea
                        id="bio"
                        placeholder="Tell us about this student..."
                        value={editForm.bio}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                        className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <Button size="sm" onClick={handleSaveProfile}>
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Profile Header */}
                    <div className="flex items-start space-x-4">
                      <div className="relative">
                        {student.avatar_url ? (
                          <img 
                            src={student.avatar_url} 
                            alt="Student avatar" 
                            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center border-2 border-gray-200">
                            <GraduationCap className="w-8 h-8 text-blue-600" />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute -bottom-1 -right-1 w-7 h-7 p-0 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
                          onClick={() => setShowAvatarDialog(true)}
                        >
                          <Camera className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">Student</p>
                        {student.bio && (
                          <p className="text-sm text-gray-600 leading-relaxed">{student.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* Student Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Class</p>
                            <p className="text-sm font-medium text-gray-900">{classInfo?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Joined</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDateTime(student.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {student.id_number && (
                          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                            <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-xs text-white font-bold">ID</span>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 uppercase tracking-wide">Student ID</p>
                              <p className="text-sm font-medium text-blue-900">{student.id_number}</p>
                            </div>
                          </div>
                        )}
                        {(student.grade || student.age) && (
                          <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                            <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-xs text-white font-bold">I</span>
                            </div>
                            <div>
                              <p className="text-xs text-purple-600 uppercase tracking-wide">Details</p>
                              <div className="flex items-center space-x-2">
                                {student.grade && (
                                  <Badge variant="secondary" className="text-xs">{student.grade}</Badge>
                                )}
                                {student.age && (
                                  <Badge variant="outline" className="text-xs">{student.age} years old</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                  {editMode && (
                    <>
                      <div>
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter first name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="middle_name">Middle Name</Label>
                        <Input
                          id="middle_name"
                          value={editForm.middle_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter middle name (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter last name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="suffix">Suffix</Label>
                        <Input
                          id="suffix"
                          value={editForm.suffix}
                          onChange={(e) => setEditForm(prev => ({ ...prev, suffix: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter suffix (e.g., Jr., Sr., III) (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="id_number">ID Number</Label>
                        <Input
                          id="id_number"
                          value={editForm.id_number}
                          onChange={(e) => setEditForm(prev => ({ ...prev, id_number: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter student ID number (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="grade">Grade</Label>
                        <Input
                          id="grade"
                          value={editForm.grade}
                          onChange={(e) => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter grade level (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          value={editForm.age}
                          onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter age (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          rows={3}
                          placeholder="Enter bio (optional)"
                        />
                      </div>
                    </>
                  )}

                  {/* Display full name when not in edit mode */}
                  {!editMode && (
                    <div>
                      <Label>Full Name</Label>
                      <p className="text-xl font-semibold mt-1 text-gray-900">
                        {student.name}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    {!editMode && (
                      <p className="text-gray-600 mt-1">{student.grade || 'Not specified'}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="id_number">ID Number</Label>
                    {!editMode && (
                      <div className="mt-1">
                        {student.id_number ? (
                          <Badge variant="default">ID: {student.id_number}</Badge>
                        ) : (
                          <p className="text-gray-600">Not specified</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="age">Age</Label>
                    {!editMode && (
                      <p className="text-gray-600 mt-1">{student.age ? `${student.age} years old` : 'Not specified'}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    {!editMode && (
                      <p className="text-gray-600 mt-1">{student.bio || 'No bio provided'}</p>
                    )}
                  </div>

                  <div>
                    <Label>Member Since</Label>
                    <p className="text-gray-600 mt-1">
                      {student.created_at ? new Date(student.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>

                  {editMode && (
                    <div className="flex space-x-2 pt-4">
                      <Button onClick={handleSaveProfile} className="flex-1">
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setEditMode(false)}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Stats and Class Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.posts}</p>
                        <p className="text-sm text-gray-600">Posts</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.classmates}</p>
                        <p className="text-sm text-gray-600">Classmates</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.teachers}</p>
                        <p className="text-sm text-gray-600">Teachers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Class Tabs */}
              {studentClasses.length > 1 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5" />
                      <span>Classes</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {studentClasses.map((classItem) => (
                        <Button
                          key={classItem.id}
                          variant={selectedClassId === classItem.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleClassSelection(classItem.id)}
                          className="flex items-center space-x-2"
                        >
                          <span>{classItem.name}</span>
                          {classItem.teacher && (
                            <span className="text-xs opacity-75">
                              ({classItem.teacher.name})
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Class Information */}
              {classInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5" />
                      <span>Class Information</span>
                      {studentClasses.length > 1 && (
                        <Badge variant="secondary">
                          {studentClasses.findIndex(c => c.id === selectedClassId) + 1} of {studentClasses.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Class Name</Label>
                        <p className="text-lg font-medium mt-1">{classInfo.name}</p>
                      </div>
                      
                      {classInfo.teacher && (
                        <div>
                          <Label>Teacher</Label>
                          <p className="text-lg font-medium mt-1">
                            {getDisplayName(
                              classInfo.teacher.first_name || '',
                              classInfo.teacher.last_name || '',
                              classInfo.teacher.middle_name,
                              classInfo.teacher.suffix,
                              classInfo.teacher.name
                            )}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{classInfo.teacher.email}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Recent Posts */}
            {posts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Recent Updates</span>
                  </CardTitle>
                  <CardDescription>
                    Recent posts about this student
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {posts.slice(0, 5).map((post) => (
                      <div key={post.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {post.teacher && (
                              <span className="text-sm text-purple-600 bg-purple-100 px-2">
                                {getDisplayName(
                                  post.teacher.first_name || '',
                                  post.teacher.last_name || '',
                                  post.teacher.middle_name,
                                  post.teacher.suffix,
                                  post.teacher.name
                                )}
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {formatDateTime(post.created_at)}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 whitespace-pre-wrap text-sm mb-3">{post.content}</p>
                        
                        {/* Reaction buttons */}
                        <div className="flex items-center space-x-4 text-sm">
                          {['thumbs_up', 'heart', 'clap', 'smile'].map((reactionType) => {
                            const isActive = post.userReactions?.includes(reactionType) || false
                            const count = post.reactions?.[reactionType as keyof typeof post.reactions] || 0
                            
                            return (
                              <button
                                key={reactionType}
                                type="button"
                                disabled={reactingPosts.has(post.id)}
                                onClick={() => handleReaction(post.id, reactionType)}
                                className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-colors ${
                                  isActive 
                                    ? getReactionColor(reactionType, true)
                                    : 'text-gray-500 hover:text-gray-700'
                                } ${reactingPosts.has(post.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                title={`${reactionType.replace('_', ' ')}`}
                              >
                                {getReactionIcon(reactionType)}
                                {count > 0 && <span className="text-xs">{count}</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Avatar Upload Dialog */}
        <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Profile Picture</DialogTitle>
              <DialogDescription>
                Upload a new profile picture. Supported formats: JPG, PNG, GIF (max 5MB)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="avatar">Choose Image</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Image size must be less than 5MB')
                        return
                      }
                      handleAvatarUpload(file)
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAvatarDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
} 