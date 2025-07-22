'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  Smile,
  MoreVertical,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import Link from 'next/link'
import { formatFullName, getDisplayName } from '@/lib/utils'

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
  parents?: Parent[]
}

interface Parent {
  id: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  name: string
  email: string | null
  created_at: string
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
  image_url?: string
  reactions?: {
    thumbs_up: number
    heart: number
    clap: number
    smile: number
  }
}

export default function StudentProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const studentId = params.id as string
  const resolvedSearchParams = use(searchParams)
  const classIdFromUrl = resolvedSearchParams.classId
  
  const [student, setStudent] = useState<Student | null>(null)
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false)
  const [showReactorsDialog, setShowReactorsDialog] = useState(false);
  const [reactors, setReactors] = useState<any[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSettingClassContext, setIsSettingClassContext] = useState(false)
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

  useEffect(() => {
    if (studentId && user && !authLoading) {
      fetchStudentDetails()
    }
  }, [studentId, user, authLoading, classIdFromUrl])

  // Refresh stats when student or class info changes
  useEffect(() => {
    if (student && classInfo) {
      fetchStudentStats()
    }
  }, [student, classInfo])

  const fetchStudentStats = async (studentData?: Student, classData?: Class | null) => {
    const currentStudent = studentData || student
    const currentClassInfo = classData || classInfo
    
    console.log('fetchStudentStats called with:', {
      currentStudent: currentStudent?.id,
      currentClassInfo: currentClassInfo?.id,
      studentData: studentData?.id,
      classData: classData?.id
    })
    
    if (!currentStudent || !currentClassInfo) {
      console.log('Missing student or class info:', { currentStudent: !!currentStudent, currentClassInfo: !!currentClassInfo })
      return
    }

    try {
      // Count posts for this student in this specific class
      let postsCount = 0
      let postsError = null
      
      if (currentClassInfo?.id) {
        try {
          // Use the same logic as the posts display section
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*')
            .eq('teacher_id', user?.id)
            .eq('class_id', currentClassInfo.id)
            .order('created_at', { ascending: false })

          if (postsError) {
            console.error('Error fetching posts:', postsError)
            postsCount = 0
          } else if (postsData && postsData.length > 0) {
            // Filter posts to only include those tagged with this student
            const { data: tagData, error: tagError } = await supabase
              .from('post_student_tags')
              .select('post_id')
              .eq('student_id', currentStudent.id)
              .in('post_id', postsData.map(post => post.id))

            if (tagError) {
              console.error('Error fetching post tags:', tagError)
              postsCount = 0
            } else {
              // Get the post IDs that are tagged with this student
              const taggedPostIds = tagData?.map(tag => tag.post_id) || []
              
              // Count posts that are tagged with this student
              postsCount = postsData.filter(post => taggedPostIds.includes(post.id)).length
              console.log('Posts count result:', { 
                totalPosts: postsData.length,
                taggedPostIds: taggedPostIds.length,
                finalCount: postsCount,
                classId: currentClassInfo.id
              })
            }
          } else {
            postsCount = 0
            console.log('No posts found for this class')
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
          // First try to count students using student_class table
          const { data: classStudents, error: studentClassError } = await supabase
            .from('student_class')
            .select('student_id')
            .eq('class_id', currentClassInfo.id)
          
          if (studentClassError) {
            console.log('student_class table error, trying old method...')
            // Fallback to old method using students table
            const { data: oldClassStudents, error: oldError } = await supabase
              .from('students')
              .select('id')
              .eq('class_id', currentClassInfo.id)
            
            if (oldError) {
              console.error('Error fetching classmates (both methods):', oldError)
              classmatesCount = 0
              classmatesError = oldError
            } else {
              const allStudents = oldClassStudents || []
              classmatesCount = allStudents.filter(student => student.id !== currentStudent.id).length
              console.log('Classmates count result (old method):', { totalStudents: allStudents.length, classmatesCount, classId: currentClassInfo.id })
            }
          } else {
            // Use new method
            const allStudents = classStudents || []
            classmatesCount = allStudents.filter(student => student.student_id !== currentStudent.id).length
            console.log('Classmates count result (new method):', { totalStudents: allStudents.length, classmatesCount, classId: currentClassInfo.id })
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
        try {
          // Check if class has a teacher assigned
          const { data: classData, error } = await supabase
            .from('classes')
            .select('teacher_id')
            .eq('id', currentClassInfo.id)
            .single()
          
          teachersCount = classData?.teacher_id ? 1 : 0
          teachersError = error
          console.log('Teachers count result:', { classData, teachersCount })
        } catch (error) {
          console.error('Error counting teachers:', error)
          teachersCount = 0
          teachersError = error
        }
      } else {
        console.log('No class selected, setting teachers count to 0')
      }

      const finalStats = {
        posts: postsCount || 0,
        teachers: teachersCount || 0,
        classmates: classmatesCount || 0
      }
      console.log('Setting final stats:', finalStats)
      console.log('Stats breakdown:', {
        postsCount,
        teachersCount,
        classmatesCount,
        studentId: currentStudent.id,
        classId: currentClassInfo.id,
        teacherId: user?.id
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

      // Log the final counts for debugging
      console.log('Final counts:', { postsCount, teachersCount, classmatesCount })
      console.log('Student:', currentStudent.id)
      console.log('Class:', currentClassInfo.id)
      
      setStats(finalStats)

    } catch (error) {
      console.error('Error fetching student stats:', error)
    }
  }

  const fetchStudentDetails = async () => {
    try {
      setLoading(true)
      
      console.log('Fetching student with ID:', studentId)
      console.log('Class ID from URL:', classIdFromUrl)
      console.log('User ID:', user?.id)

      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) {
        console.error('Error fetching student:', studentError)
        console.error('Student ID:', studentId)
        toast.error('Error fetching student details')
        return
      }

      if (!studentData) {
        console.error('No student data found for ID:', studentId)
        toast.error('Student not found')
        return
      }

      console.log('Student data:', studentData)

      // Get the class context from the URL - class context is required
      if (!classIdFromUrl) {
        console.error('No class ID provided in URL')
        toast.error('Class context is required to view student details. Please select a class from the dashboard.')
        return
      }

      let effectiveClassId = classIdFromUrl

      console.log('Using class ID:', effectiveClassId)
      
      // Use the class ID
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', effectiveClassId)
        .eq('teacher_id', user?.id)
        .single()

      if (classError) {
        console.error('Error fetching class:', classError)
        console.error('Class ID:', effectiveClassId)
        console.error('Teacher ID:', user?.id)
        toast.error('Error fetching class details')
        return
      }

      if (!classData) {
        console.error('No class data found for ID:', effectiveClassId)
        toast.error('Class not found or you do not have access to it')
        return
      }

      console.log('Class data:', classData)

      // Verify the student is in this class
      console.log('Checking if student is in class...')
      const { data: studentInClass, error: studentInClassError } = await supabase
        .from('student_class')
        .select('student_id')
        .eq('student_id', studentId)
        .eq('class_id', effectiveClassId)
        .single()

      if (studentInClassError) {
        console.log('Student not found in student_class table, checking old method...')
        // Fallback to old method
        if (studentData.class_id === effectiveClassId) {
          console.log('Student found in old class_id method')
          setClassInfo(classData)
        } else {
          console.error('Student is not enrolled in this class')
          console.error('Student class_id:', studentData.class_id)
          console.error('Requested class_id:', effectiveClassId)
          toast.error('Student is not enrolled in this class')
          return
        }
      } else {
        console.log('Student found in student_class table')
        setClassInfo(classData)
      }

      // Debug: Check if student is properly enrolled
      console.log('Student enrollment check:', {
        studentId,
        classId: effectiveClassId,
        studentClassId: studentData.class_id,
        studentInClass: !!studentInClass,
        studentInClassError: studentInClassError?.message
      })

      // Debug: Check database state
      console.log('Database state check:', {
        student: {
          id: studentData.id,
          name: studentData.name,
          class_id: studentData.class_id
        },
        class: {
          id: classData.id,
          name: classData.name,
          teacher_id: classData.teacher_id
        },
        user: {
          id: user?.id,
          email: user?.email
        }
      })

      // Debug: Check for existing posts
      const { data: debugPosts, error: debugPostsError } = await supabase
        .from('posts')
        .select('id, content, class_id, teacher_id')
        .eq('class_id', effectiveClassId)
        .eq('teacher_id', user?.id)

      console.log('Debug posts check:', {
        posts: debugPosts,
        error: debugPostsError,
        classId: effectiveClassId,
        teacherId: user?.id
      })

      // Debug: Check for post tags
      if (debugPosts && debugPosts.length > 0) {
        const { data: debugTags, error: debugTagsError } = await supabase
          .from('post_student_tags')
          .select('post_id, student_id')
          .eq('student_id', studentId)
          .in('post_id', debugPosts.map(p => p.id))

        console.log('Debug tags check:', {
          tags: debugTags,
          error: debugTagsError,
          studentId,
          postIds: debugPosts.map(p => p.id)
        })
      }

      // Debug: Check for students in class
      const { data: debugStudents, error: debugStudentsError } = await supabase
        .from('student_class')
        .select('student_id')
        .eq('class_id', effectiveClassId)

      console.log('Debug students check:', {
        students: debugStudents,
        error: debugStudentsError,
        classId: effectiveClassId,
        totalStudents: debugStudents?.length || 0
      })

      // Debug: Check if student is in this class
      const { data: studentInClassDebug, error: studentInClassDebugError } = await supabase
        .from('student_class')
        .select('student_id')
        .eq('student_id', studentId)
        .eq('class_id', effectiveClassId)

      console.log('Debug student in class check:', {
        studentInClass: studentInClassDebug,
        error: studentInClassDebugError,
        studentId,
        classId: effectiveClassId
      })

      // Debug: Check for posts specifically for this student
      const { data: studentPostsDebug, error: studentPostsDebugError } = await supabase
        .from('post_student_tags')
        .select(`
          post_id,
          posts (
            id,
            content,
            class_id,
            teacher_id
          )
        `)
        .eq('student_id', studentId)

      console.log('Debug student posts check:', {
        studentPosts: studentPostsDebug,
        error: studentPostsDebugError,
        studentId,
        totalPosts: studentPostsDebug?.length || 0
      })

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

      // Parse the student name to get first and last name
      const nameParts = studentData.name?.split(' ') || []
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      // Set edit form
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

      // Fetch posts for this student in this specific class
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('teacher_id', user?.id)
        .eq('class_id', effectiveClassId)
        .order('created_at', { ascending: false })

      if (postsError) {
        console.error('Error fetching posts:', postsError)
        setPosts([])
      } else if (postsData && postsData.length > 0) {
        // Filter posts to only include those tagged with this student
        const { data: tagData, error: tagError } = await supabase
          .from('post_student_tags')
          .select('post_id')
          .eq('student_id', studentId)
          .in('post_id', postsData.map(post => post.id))

        if (tagError) {
          console.error('Error fetching post tags:', tagError)
          setPosts([])
        } else {
          // Get the post IDs that are tagged with this student
          const taggedPostIds = tagData?.map(tag => tag.post_id) || []
          
          // Filter posts to only include those tagged with this student
          const studentPosts = postsData.filter(post => taggedPostIds.includes(post.id))

          // Fetch reactions for each post
          const postsWithReactions = await Promise.all(
            (studentPosts || []).map(async (post) => {
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
        setPosts([])
      }

      // Fetch stats after all data is loaded
      await fetchStudentStats(studentData, classData)

    } catch (error) {
      console.error('Error fetching student details:', error)
      console.error('Error details:', {
        studentId,
        classIdFromUrl,
        userId: user?.id,
        error: error instanceof Error ? error.message : error
      })
      toast.error('Error fetching student details')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!student) return

    try {
      setUploadingAvatar(true)

      // Upload to Supabase Storage with proper folder structure
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
          name: uploadError.name,
          details: uploadError.details,
          hint: uploadError.hint
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
        console.error('Error updating student avatar:', updateError)
        toast.error('Error updating student avatar: ' + updateError.message)
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
        console.error('Error updating student:', error)
        toast.error('Error updating student profile')
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
      console.error('Error updating student profile:', error)
      toast.error('Error updating student profile')
    }
  }

  const handleCreatePost = async (postData: { content: string; image_url?: string }) => {
    try {
      // First, create the post with class context
      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert([{
          content: postData.content,
          teacher_id: user?.id,
          class_id: classInfo?.id, // Always include class context
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
      await fetchStudentStats() // Refresh stats
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

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setShowEditDialog(true);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    // Mark as deleting for visual feedback
    setDeletingIds(prev => new Set(prev).add(postId));

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        console.error('Error deleting post:', error);
        toast.error('Error deleting post: ' + error.message);
        // Remove from deleting state
        setDeletingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        return;
      }

      // Optimistic update - remove from UI with animation
      setPosts(prev => prev.filter(post => post.id !== postId));
      
      // Refresh stats to reflect the deleted post
      await fetchStudentStats();
      
      toast.success('Post deleted successfully!');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Error deleting post');
      // Remove from deleting state
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editContent.trim()) {
      toast.error('Please enter post content');
      return;
    }

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent.trim() })
        .eq('id', editingPost.id);

      if (error) {
        console.error('Error updating post:', error);
        toast.error('Error updating post: ' + error.message);
        return;
      }

      toast.success('Post updated successfully!');
      setShowEditDialog(false);
      setEditingPost(null);
      setEditContent('');
      await fetchStudentDetails(); // Refresh the posts
      await fetchStudentStats(); // Refresh stats
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Error updating post');
    } finally {
      setEditLoading(false);
    }
  };

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



        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posts</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.posts}</div>
              <p className="text-xs text-muted-foreground">
                Progress updates
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teachers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.teachers}</div>
              <p className="text-xs text-muted-foreground">
                Teaching this student
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Classmates</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.classmates}</div>
              <p className="text-xs text-muted-foreground">
                In the same class
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <GraduationCap className="w-5 h-5" />
                    <span>Student Information</span>
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
                              {new Date(student.created_at).toLocaleDateString()}
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
              </CardContent>
            </Card>

            {/* Parents Info */}
            {student.parents && student.parents.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>{student.parents.length === 1 ? 'Parent' : 'Parents'}</span>
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
                      <div 
                        key={post.id} 
                        className={`border rounded-lg p-4 transition-all duration-300 ease-in-out ${
                          deletingIds.has(post.id) 
                            ? 'opacity-50 scale-95 bg-gray-50' 
                            : 'opacity-100 scale-100'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                disabled={deletingIds.has(post.id)}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleEdit(post)}
                                disabled={deletingIds.has(post.id)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(post.id)}
                                className="text-red-600 focus:text-red-600"
                                disabled={deletingIds.has(post.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              <DialogTitle>
                Create Post About {student.name}
                {classInfo && (
                  <span className="text-sm font-normal text-gray-600 block">
                    for {classInfo.name} Class
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                Share updates about {student.name}'s progress in {classInfo?.name || 'this'} class with their parents
              </DialogDescription>
            </DialogHeader>
            <CreatePostForm 
              onSubmit={handleCreatePost}
              studentName={student.name || 'Student'}
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

        {/* Avatar Upload Dialog */}
        <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Student Avatar</DialogTitle>
              <DialogDescription>
                Upload a profile picture for {student.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleAvatarUpload(file)
                      }
                    }}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors">
                    {uploadingAvatar ? (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Uploading...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Supported formats: JPG, PNG, GIF. Max size: 5MB
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Post Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>
                Update the content of your post about {student ? student.name : 'this student'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Enter post content..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingPost(null);
                    setEditContent('');
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