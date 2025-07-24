'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Users, BookOpen, GraduationCap, MessageSquare, ChevronDown, ChevronRight, Eye, Trash2, ThumbsUp, Heart, Star, Smile, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { toast } from 'sonner'
import Link from 'next/link'

// Generate a random password for parent accounts
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

interface Stats {
  classes: number
  parents: number
  students: number
  posts: number
}

interface Class {
  id: string
  name: string
  created_at: string
  students?: Student[]
}

interface Student {
  id: string
  name: string
  id_number?: string
  class_id: string
  created_at: string
  avatar_url?: string
  parents?: Parent[]
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at: string
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

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    classes: 0,
    parents: 0,
    students: 0,
    posts: 0
  })
  const [classes, setClasses] = useState<Class[]>([])
  const [classAnnouncements, setClassAnnouncements] = useState<ClassAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClasses, setExpandedClasses] = useState<string[]>([])
  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false)
  const [isDeleteStudentOpen, setIsDeleteStudentOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null)
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<string>('')
  const [showCredentials, setShowCredentials] = useState(false)
  const [parentCredentials, setParentCredentials] = useState<{ email: string; password: string } | null>(null)
  const [showReactorsDialog, setShowReactorsDialog] = useState(false);
  const [reactors, setReactors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<ClassAnnouncement | null>(null);

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch classes count for this teacher
      const { count: classesCount, error: classesError } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user?.id)

      // First, get the teacher's classes
      const { data: classesData, error: classesDataError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user?.id)

      if (classesDataError) {
        console.error('Error fetching classes for stats:', classesDataError)
      }

      const classIds = classesData?.map(c => c.id) || []

      // Fetch students count for this teacher's classes
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds)

      // Fetch parents count for students in this teacher's classes
      let studentParentsData = null
      let studentParentsError = null

      if (classIds.length > 0) {
        // First get student IDs for the teacher's classes
        const { data: studentsData, error: studentsDataError } = await supabase
          .from('students')
          .select('id')
          .in('class_id', classIds)

        if (studentsDataError) {
          console.error('Error fetching students for parent count:', studentsDataError)
        } else {
          const studentIds = studentsData?.map(s => s.id) || []
          
          if (studentIds.length > 0) {
            const { data: spData, error: spError } = await supabase
              .from('student_parent')
              .select('parent_id')
              .in('student_id', studentIds)

            studentParentsData = spData
            studentParentsError = spError
          }
        }
      }

      // Get unique parent IDs from students
      const uniqueParentIds = new Set(studentParentsData?.map(sp => sp.parent_id) || [])

      // Also fetch all parents (including those without students yet)
      // This allows teachers to see parents they've created even if they haven't been linked to students
      const { data: allParentsData, error: allParentsError } = await supabase
        .from('parents')
        .select('*')
        .order('created_at', { ascending: false })

      if (allParentsError) {
        console.error('Error fetching all parents:', allParentsError)
      }

      // Combine parents from students and all parents, removing duplicates
      const allParentIds = new Set([
        ...uniqueParentIds,
        ...(allParentsData?.map(p => p.id) || [])
      ])

      const parentsCount = allParentIds.size

      // Fetch posts count for this teacher
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user?.id)

      setStats({
        classes: classesCount || 0,
        parents: parentsCount,
        students: studentsCount || 0,
        posts: postsCount || 0
      })

      // Fetch classes with students and parents
      await fetchClassesWithDetails()

      // Fetch class announcements with reactions
      await fetchClassAnnouncements()

      // Log any errors for debugging
      if (classesError) console.error('Error fetching classes:', classesError)
      if (studentsError) console.error('Error fetching students:', studentsError)
      if (studentParentsError) console.error('Error fetching student-parent relationships:', studentParentsError)
      if (postsError) console.error('Error fetching posts:', postsError)

    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClassesWithDetails = async () => {
    try {
      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false })

      if (classesError) {
        console.error('Error fetching classes:', classesError)
        return
      }

      const classesWithDetails = await Promise.all(
        (classesData || []).map(async (classItem) => {
          // Fetch students for this class using the student_class relationship table
          const { data: studentClassData, error: studentClassError } = await supabase
            .from('student_class')
            .select('student_id')
            .eq('class_id', classItem.id)

          if (studentClassError) {
            console.error('Error fetching student-class relationships for class:', classItem.id, studentClassError)
            return { ...classItem, students: [] }
          }

          const studentIds = studentClassData?.map(sc => sc.student_id) || []

          if (studentIds.length === 0) {
            return { ...classItem, students: [] }
          }

          // Fetch students for this class
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('id, name, id_number, class_id, created_at, avatar_url')
            .in('id', studentIds)
            .order('created_at', { ascending: false })

          if (studentsError) {
            console.error('Error fetching students for class:', classItem.id, studentsError)
            return { ...classItem, students: [] }
          }

          // Fetch parents for each student
          const studentsWithParents = await Promise.all(
            (studentsData || []).map(async (student) => {
              const { data: studentParentsData, error: studentParentsError } = await supabase
                .from('student_parent')
                .select('parent_id')
                .eq('student_id', student.id)

              if (studentParentsError) {
                console.error('Error fetching parents for student:', student.id, studentParentsError)
                return { ...student, parents: [] }
              }

              const parentIds = studentParentsData?.map(sp => sp.parent_id) || []
              
              if (parentIds.length === 0) {
                return { ...student, parents: [] }
              }

              const { data: parentsData, error: parentsError } = await supabase
                .from('parents')
                .select('*')
                .in('id', parentIds)

              if (parentsError) {
                console.error('Error fetching parents:', parentsError)
                return { ...student, parents: [] }
              }

              return { ...student, parents: parentsData || [] }
            })
          )

          return { ...classItem, students: studentsWithParents }
        })
      )

      setClasses(classesWithDetails)
      // Auto-expand all classes by default
      setExpandedClasses(classesWithDetails.map(classItem => classItem.id))
    } catch (error) {
      console.error('Error fetching classes with details:', error)
    }
  }

  const fetchClassAnnouncements = async () => {
    try {
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
        setClassAnnouncements([])
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
        setClassAnnouncements([])
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
              class: item.classes,
              image_url: item.image_url,
              file_url: item.file_url,
              file_name: item.file_name,
              reactions,
              userReactions: []  // Teachers don't react to their own posts
            }
          })
        )

        setClassAnnouncements(announcementsWithReactions)
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
        setClassAnnouncements([])
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
            class: item.classes,
            image_url: item.image_url,
            file_url: item.file_url,
            file_name: item.file_name,
            reactions,
            userReactions: []  // Teachers don't react to their own posts
          }
        })
      )

      setClassAnnouncements(announcementsWithReactions)
    } catch (error) {
      console.error('Error fetching class announcements:', error)
      setClassAnnouncements([])
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

  const statsData = [
    {
      title: 'My Classes',
      value: stats.classes.toString(),
      icon: BookOpen,
      description: 'Classes you teach',
      href: '/teacher/classes'
    },
    {
      title: 'My Students\' Parents',
      value: stats.parents.toString(),
      icon: Users,
      description: 'Parents of your students',
      href: '/teacher/parents'
    },
    {
      title: 'My Students',
      value: stats.students.toString(),
      icon: GraduationCap,
      description: 'Students in your classes',
      href: '/teacher/students'
    },
    {
      title: 'My Posts',
      value: stats.posts.toString(),
      icon: MessageSquare,
      description: 'Posts you\'ve created',
      href: '/teacher/posts'
    }
  ]

  const toggleClassExpansion = (classId: string) => {
    setExpandedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
  }

  const handleAddClass = async (classData: { name: string; studentIds?: string[] }) => {
    try {
      const { data: classResult, error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          teacher_id: user?.id
        }])
        .select()
        .single()

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      // If students are selected, update their class_id
      if (classData.studentIds && classData.studentIds.length > 0) {
        const { error: updateError } = await supabase
          .from('students')
          .update({ class_id: classResult.id })
          .in('id', classData.studentIds)

        if (updateError) {
          console.error('Error updating students:', updateError)
          toast.error('Class created but failed to assign students')
          return
        }
      }

      await fetchData()
      setIsAddClassOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

  const handleAddStudent = async (studentData: { first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => {
    try {
      // Verify the class belongs to this teacher
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', studentData.class_id)
        .eq('teacher_id', user?.id)
        .single()

      if (classError || !classData) {
        toast.error('Invalid class selected')
        return
      }

      // First add the student - using old name field for now until schema is updated
      const studentDataToInsert: any = {
        name: `${studentData.first_name} ${studentData.last_name}`.trim(),
        class_id: studentData.class_id  // Set the class_id when creating the student
      }
      
      // Only add id_number if it's provided and not empty
      if (studentData.id_number && studentData.id_number.trim()) {
        studentDataToInsert.id_number = studentData.id_number.trim()
      }
      
      const { data: studentResult, error: studentError } = await supabase
        .from('students')
        .insert([studentDataToInsert])
        .select()

      if (studentError) {
        console.error('Error adding student:', studentError)
        console.error('Student data being inserted:', studentDataToInsert)
        toast.error('Error creating student: ' + studentError.message)
        return
      }

      // Then create the student-parent relationship
      if (studentResult && studentResult[0]) {
        const { error: relationshipError } = await supabase
          .from('student_parent')
          .insert([{
            student_id: studentResult[0].id,
            parent_id: studentData.parent_id
          }])

        if (relationshipError) {
          console.error('Error creating student-parent relationship:', relationshipError)
          // Still show success since student was created
        }

        // Create the student-class relationship (as a backup/consistency measure)
        const { error: classRelationshipError } = await supabase
          .from('student_class')
          .insert([{
            student_id: studentResult[0].id,
            class_id: studentData.class_id
          }])

        if (classRelationshipError) {
          console.error('Error creating student-class relationship:', classRelationshipError)
          // This is okay since we already set class_id on the student record
        }
      }

      await fetchData()
      setIsAddStudentOpen(false)
      toast.success('Student created successfully!')
    } catch (error) {
      console.error('Error adding student:', error)
      toast.error('Error creating student')
    }
  }

  // Add this function to handle student deletion
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    setStudentToDelete({ id: studentId, name: studentName })
    setIsDeleteStudentOpen(true)
  }

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return

    try {
      // Verify the student belongs to one of this teacher's classes
      const { data: studentClassData, error: studentClassError } = await supabase
        .from('student_class')
        .select('class_id')
        .eq('student_id', studentToDelete.id)

      if (studentClassError) {
        console.error('Error checking student classes:', studentClassError)
        toast.error('Error checking student classes')
        return
      }

      if (!studentClassData || studentClassData.length === 0) {
        toast.error('Student not found in any classes')
        return
      }

      const classIds = studentClassData.map(sc => sc.class_id)

      // Check if any of these classes belong to this teacher
      const { data: teacherClassesData, error: teacherClassesError } = await supabase
        .from('classes')
        .select('id')
        .in('id', classIds)
        .eq('teacher_id', user?.id)

      if (teacherClassesError || !teacherClassesData || teacherClassesData.length === 0) {
        toast.error('You can only delete students from your own classes')
        return
      }

      // Delete the student (this will cascade delete all relationships)
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete.id)

      if (error) {
        console.error('Error deleting student:', error)
        toast.error('Error deleting student: ' + error.message)
      } else {
        await fetchData()
        toast.success('Student deleted successfully!')
        setIsDeleteStudentOpen(false)
        setStudentToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting student:', error)
      toast.error('Error deleting student')
    }
  }

  // Add this function to handle managing students for a class
  const handleManageStudents = async (classId: string, studentIds: string[]) => {
    try {
      if (studentIds.length === 0) {
        toast.error('Please select at least one student to add')
        return
      }

      // Try to create student-class relationships for the selected students
      const relationships = studentIds.map(studentId => ({
        student_id: studentId,
        class_id: classId
      }))

      const { error } = await supabase
        .from('student_class')
        .insert(relationships)

      if (error) {
        console.error('Error adding students to class:', error)
        // If the table doesn't exist, fall back to updating the class_id field
        const { error: updateError } = await supabase
          .from('students')
          .update({ class_id: classId })
          .in('id', studentIds)

        if (updateError) {
          console.error('Error updating students:', updateError)
          toast.error('Error adding students to class: ' + updateError.message)
          return
        }
      }

      await fetchData()
      setIsManageStudentsOpen(false)
      toast.success('Students added to class successfully!')
    } catch (error) {
      console.error('Error managing students:', error)
      toast.error('Error adding students to class')
    }
  }

  // Add this function to handle removing a student from a specific class
  const handleRemoveFromClass = async (studentId: string, classId: string) => {
    if (!confirm('Are you sure you want to remove this student from this class?')) {
      return
    }
    try {
      // Try to remove the student-class relationship
      const { error } = await supabase
        .from('student_class')
        .delete()
        .eq('student_id', studentId)
        .eq('class_id', classId)

      if (error) {
        console.error('Error removing student from class:', error)
        // If the table doesn't exist, fall back to setting class_id to null
        const { error: updateError } = await supabase
          .from('students')
          .update({ class_id: null })
          .eq('id', studentId)
          .eq('class_id', classId)

        if (updateError) {
          console.error('Error updating student:', updateError)
          toast.error('Error removing student from class: ' + updateError.message)
          return
        }
      }

      await fetchData()
      toast.success('Student removed from class successfully!')
    } catch (error) {
      console.error('Error removing student from class:', error)
      toast.error('Error removing student from class')
    }
  }

  // Add this function to fetch reactors for a post and reaction type
  const fetchReactors = async (announcementId: string, reactionType: string) => {
    setReactorsLoading(true);
    setReactors([]);
    setSelectedReaction(reactionType);
    setShowReactorsDialog(true);
    setSelectedAnnouncement(classAnnouncements.find(a => a.id === announcementId) || null);
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('parent_id, parents(name, email, created_at)')
        .eq('post_id', announcementId)
        .eq('reaction_type', reactionType);
      if (error) {
        toast.error('Error fetching reactors');
        setReactors([]);
      } else {
        setReactors((data || []).map((r: any) => {
          const parent = Array.isArray(r.parents) ? r.parents[0] : r.parents;
          return {
            id: r.parent_id,
            name: parent?.name || 'Unknown',
            email: parent?.email || ''
          };
        }));
      }
    } catch (e) {
      toast.error('Error fetching reactors');
      setReactors([]);
    } finally {
      setReactorsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Teacher Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your classes, students, and communicate with parents
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {statsData.map((stat, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-blue-300"
              onClick={() => window.location.href = stat.href}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Class Announcements Section */}
        {classAnnouncements.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Recent Class Announcements</span>
                  </CardTitle>
                  <CardDescription>
                    Your recent class-wide announcements and parent reactions
                  </CardDescription>
                </div>
                <Link href="/teacher/announcements">
                  <Button variant="outline" size="sm">
                    View All Announcements
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classAnnouncements.slice(0, 3).map((announcement) => (
                  <div key={announcement.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {announcement.class && (
                          <span className="text-sm text-purple-600 bg-purple-100 px-2">{announcement.class.name}</span>
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
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                         announcement.reactions.smile === 0)) && null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classes Management */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center space-x-2 text-gray-900">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span>My Classes</span>
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Manage your classes and their students • {classes.length} class{classes.length !== 1 ? 'es' : ''}
                </CardDescription>
              </div>
              <Button 
                onClick={() => setIsAddClassOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Loading classes...</span>
                </div>
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No classes yet</h3>
                <p className="text-gray-500 mb-4">Create your first class to get started managing students and communicating with parents.</p>
                <Button 
                  onClick={() => setIsAddClassOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Class
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {classes.map((classItem, index) => (
                  <div key={classItem.id} className="group hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between p-6">
                      <div 
                        className="flex items-center space-x-4 cursor-pointer flex-1"
                        onClick={() => toggleClassExpansion(classItem.id)}
                      >
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold">
                            {classItem.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {classItem.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              <Users className="w-4 h-4" />
                              <span>{classItem.students?.length || 0} student{(classItem.students?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              <BookOpen className="w-4 h-4" />
                              <span>Created {new Date(classItem.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {expandedClasses.includes(classItem.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Link href={`/teacher/classes/${classItem.id}/posts`}>
                          <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                            <MessageSquare className="mr-2 h-3 w-3" />
                            Announcements
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedClassForStudent(classItem.id)
                            setIsManageStudentsOpen(true)
                          }}
                          className="border-green-200 text-green-700 hover:bg-green-50"
                        >
                          <Users className="mr-2 h-3 w-3" />
                          Manage
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedClassForStudent(classItem.id)
                            setIsAddStudentOpen(true)
                          }}
                          className="border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Add Student
                        </Button>
                      </div>
                    </div>
                    
                    {expandedClasses.includes(classItem.id) && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                              Students in {classItem.name}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {classItem.students?.length || 0} total
                            </span>
                          </div>
                          
                          {classItem.students && classItem.students.length > 0 ? (
                            <div className="grid gap-3">
                              {classItem.students.map((student) => (
                                <div key={student.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1">
                                      {student.avatar_url ? (
                                        <img 
                                          src={student.avatar_url} 
                                          alt={`${student.name} avatar`} 
                                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                          {student.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-gray-900 truncate">{student.name}</h5>
                                        <div className="flex items-center space-x-2 mt-1">
                                          {student.id_number && (
                                            <Badge variant="secondary" className="text-xs">
                                              ID: {student.id_number}
                                            </Badge>
                                          )}
                                                                                     {student.parents && student.parents.length > 0 ? (
                                             <div className="flex items-center space-x-1 text-xs text-gray-500">
                                               <Users className="w-3 h-3" />
                                               <span>{student.parents.map(p => p.name).join(', ')}</span>
                                             </div>
                                           ) : (
                                             <span className="text-xs text-red-500">No parents assigned</span>
                                           )}
                                        </div>
                                      </div>
                                    </div>
                                                                         <div className="flex items-center gap-2 ml-4">
                                       <Link href={`/teacher/students/${student.id}?classId=${classItem.id}`}>
                                         <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                           <Eye className="w-4 h-4" />
                                         </Button>
                                       </Link>
                                       <DropdownMenu>
                                         <DropdownMenuTrigger asChild>
                                           <Button size="sm" variant="ghost" className="text-gray-600 hover:text-gray-700 hover:bg-gray-50">
                                             <MoreHorizontal className="w-4 h-4" />
                                           </Button>
                                         </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end">
                                           <DropdownMenuItem onClick={() => handleRemoveFromClass(student.id, classItem.id)}>
                                             <Users className="w-4 h-4 mr-2 text-orange-600" />
                                             <span className="text-orange-600">Remove from Class</span>
                                           </DropdownMenuItem>
                                           <DropdownMenuItem onClick={() => handleDeleteStudent(student.id, student.name)}>
                                             <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                                             <span className="text-red-600">Delete Student</span>
                                           </DropdownMenuItem>
                                         </DropdownMenuContent>
                                       </DropdownMenu>
                                     </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                              <p className="text-gray-500 text-sm">No students in this class yet</p>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedClassForStudent(classItem.id)
                                  setIsAddStudentOpen(true)
                                }}
                                className="mt-2"
                              >
                                <Plus className="mr-2 h-3 w-3" />
                                Add First Student
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Class Dialog */}
        <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Create a new class for your students
              </DialogDescription>
            </DialogHeader>
            <AddClassForm onSubmit={handleAddClass} />
          </DialogContent>
        </Dialog>

        {/* Add Student Dialog */}
        <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Add a new student to a class and assign them to a parent
              </DialogDescription>
            </DialogHeader>
            <AddStudentForm 
              onSubmit={handleAddStudent}
              selectedClassId={selectedClassForStudent}
              classes={classes}
              onParentCreated={(credentials) => {
                setParentCredentials(credentials)
                setShowCredentials(true)
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Manage Students Dialog */}
        <Dialog open={isManageStudentsOpen} onOpenChange={setIsManageStudentsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Students</DialogTitle>
              <DialogDescription>
                Add existing students to this class
              </DialogDescription>
            </DialogHeader>
            <ManageStudentsForm 
              onSubmit={(data) => handleManageStudents(data.classId, data.studentIds)}
              classId={selectedClassForStudent}
              className={classes.find(c => c.id === selectedClassForStudent)?.name || ''}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Student Confirmation Dialog */}
        <Dialog open={isDeleteStudentOpen} onOpenChange={setIsDeleteStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Student</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this student? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {studentToDelete && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-900">Student to Delete:</span>
                  </div>
                  <div className="text-sm text-red-800">
                    <p><strong>Name:</strong> {studentToDelete.name}</p>
                    <p className="text-xs mt-1">This will permanently remove the student from all classes and delete all associated data.</p>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsDeleteStudentOpen(false)
                      setStudentToDelete(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeleteStudent}
                  >
                    Delete Student
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Parent Credentials Dialog */}
        <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Parent Account Created</DialogTitle>
              <DialogDescription>
                The parent account has been created successfully. Please share these login credentials with the parent.
              </DialogDescription>
            </DialogHeader>
            {parentCredentials && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Login Credentials</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Email:</span> {parentCredentials.email}
                    </div>
                    <div>
                      <span className="font-medium">Password:</span> {parentCredentials.password}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  The parent can now log in at the app and view their child's progress updates.
                </p>
                <Button 
                  onClick={() => setShowCredentials(false)}
                  className="w-full"
                >
                  Close
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
      </div>
    </Layout>
  )
}



// Add Class Form Component
function AddClassForm({ onSubmit }: { onSubmit: (data: { name: string; studentIds?: string[] }) => void }) {
  const [name, setName] = useState('')
  const [showStudentSelection, setShowStudentSelection] = useState(true)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [existingStudents, setExistingStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchExistingStudents()
  }, [])

  const fetchExistingStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, id_number, class_id, created_at, avatar_url')
        .order('name')
      
      if (error) {
        console.error('Error fetching students:', error)
      } else {
        setExistingStudents(data || [])
      }
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      // Create the class first
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .insert([{
          name: name.trim(),
          teacher_id: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single()

      if (classError) {
        console.error('Error creating class:', classError)
        toast.error('Error creating class')
        return
      }

      // If students are selected, create student-class relationships
      if (selectedStudents.length > 0) {
        const relationships = selectedStudents.map(studentId => ({
          student_id: studentId,
          class_id: classData.id
        }))

        const { error: relationshipError } = await supabase
          .from('student_class')
          .insert(relationships)

        if (relationshipError) {
          console.error('Error creating student-class relationships:', relationshipError)
          toast.error('Class created but failed to assign students')
          return
        }
      }

      onSubmit({ name: name.trim(), studentIds: selectedStudents })
      setName('')
      setSelectedStudents([])
      setShowStudentSelection(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error creating class:', error)
      toast.error('Error creating class')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="className">Class Name</Label>
        <Input
          id="className"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter class name"
          required
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Add Existing Students</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowStudentSelection(!showStudentSelection)}
          >
            {showStudentSelection ? 'Hide' : 'Show'} Student Selection
          </Button>
        </div>

        {showStudentSelection && (
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600 mb-3">
              Select students to add to this new class:
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {existingStudents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No existing students found
                </p>
              ) : (
                existingStudents.map((student) => (
                  <label key={student.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents([...selectedStudents, student.id])
                        } else {
                          setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                        }
                      }}
                      className="rounded"
                    />
                    {student.avatar_url ? (
                      <img 
                        src={student.avatar_url} 
                        alt={`${student.name} avatar`} 
                        className="w-6 h-6 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <span className="text-sm font-medium">{student.name}</span>
                      {student.id_number && (
                        <span className="text-xs text-gray-500 ml-2">ID: {student.id_number}</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            {selectedStudents.length > 0 && (
              <div className="text-sm text-gray-600">
                {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Class'}
        </Button>
      </div>
    </form>
  )
}

// Add Student Form Component
function AddStudentForm({ 
  onSubmit, 
  selectedClassId,
  classes,
  onParentCreated
}: { 
  onSubmit: (data: { first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => void
  selectedClassId: string
  classes: Class[]
  onParentCreated?: (credentials: { email: string; password: string }) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [classId, setClassId] = useState(selectedClassId)
  const [parentId, setParentId] = useState('')
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [newParentPassword, setNewParentPassword] = useState('')

  useEffect(() => {
    fetchParents()
  }, [])

  const fetchParents = async () => {
    try {
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error fetching parents:', error)
      } else {
        setParents(data || [])
      }
    } catch (error) {
      console.error('Error fetching parents:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter both first name and last name')
      return
    }
    
    if (showAddParent) {
      // We're adding a new parent, validate parent fields
      if (!newParentName.trim()) {
        toast.error('Please enter a parent name')
        return
      }
      
      if (!newParentEmail.trim()) {
        toast.error('Please enter a parent email')
        return
      }
      
      if (!newParentPassword.trim()) {
        toast.error('Please enter a password for the parent')
        return
      }
      
      // Create the parent first
      setLoading(true)
      try {
        // Check if parent with this email already exists
        const { data: existingParent, error: checkError } = await supabase
          .from('parents')
          .select('*')
          .eq('email', newParentEmail.trim())
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing parent:', checkError)
          toast.error('Error checking existing parent')
          return
        }

        if (existingParent) {
          const useExisting = confirm(
            `A parent with email "${newParentEmail.trim()}" already exists:\n\n` +
            `Name: ${existingParent.name}\n` +
            `Email: ${existingParent.email}\n\n` +
            `Would you like to use this existing parent instead?`
          )
          
          if (useExisting) {
            // Use existing parent
            await onSubmit({ 
              first_name: firstName.trim(), 
              last_name: lastName.trim(),
              middle_name: middleName.trim() || undefined,
              suffix: suffix.trim() || undefined,
              id_number: idNumber.trim() || undefined,
              class_id: classId, 
              parent_id: existingParent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setFirstName('')
            setLastName('')
            setMiddleName('')
            setSuffix('')
            setIdNumber('')
            setParentId('')
            setLoading(false)
            return
          } else {
            setNewParentEmail('')
            setLoading(false)
            return
          }
        }

        // Create new parent with auth account
        try {
          // Validate password
          if (!newParentPassword.trim()) {
            toast.error('Please enter a password for the parent')
            return
          }
          
          // Create parent using API endpoint (doesn't log in the user)
          const response = await fetch('/api/create-parent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: newParentEmail.trim(),
              password: newParentPassword.trim(),
              name: newParentName.trim()
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('API Error Response:', errorText)
            toast.error('Error creating parent account. Please check the console for details.')
            setLoading(false)
            return
          }

          const result = await response.json()

          if (result.success && result.parent) {
            // Now add the student with the new parent
            await onSubmit({ 
              first_name: firstName.trim(), 
              last_name: lastName.trim(),
              middle_name: middleName.trim() || undefined,
              suffix: suffix.trim() || undefined,
              id_number: idNumber.trim() || undefined,
              class_id: classId, 
              parent_id: result.parent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setFirstName('')
            setLastName('')
            setMiddleName('')
            setSuffix('')
            setIdNumber('')
            setParentId('')
            setLoading(false)
            
            // Show credentials dialog
            if (onParentCreated) {
              onParentCreated({
                email: newParentEmail.trim(),
                password: newParentPassword.trim()
              })
            }
            return
          } else {
            console.error('API returned error:', result)
            toast.error('Error creating parent account: ' + (result.error || 'Unknown error'))
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Error creating parent:', error)
          toast.error('Error creating parent')
          setLoading(false)
          return
        }
      } catch (error) {
        console.error('Error creating parent:', error)
        toast.error('Error creating parent')
        setLoading(false)
        return
      }
    } else {
      // We're using an existing parent
      if (!parentId) {
        toast.error('Please select a parent for the student')
        return
      }
      
      setLoading(true)
      await onSubmit({ 
        first_name: firstName.trim(), 
        last_name: lastName.trim(),
        middle_name: middleName.trim() || undefined,
        suffix: suffix.trim() || undefined,
        id_number: idNumber.trim() || undefined,
        class_id: classId, 
        parent_id: parentId 
      })
      setFirstName('')
      setLastName('')
      setMiddleName('')
      setSuffix('')
      setIdNumber('')
      setParentId('')
      setLoading(false)
    }
  }

  const selectedParent = parents.find(p => p.id === parentId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name *</Label>
        <Input
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter first name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name *</Label>
        <Input
          id="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter last name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="middleName">Middle Name</Label>
        <Input
          id="middleName"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
          placeholder="Enter middle name (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="suffix">Suffix</Label>
        <Input
          id="suffix"
          value={suffix}
          onChange={(e) => setSuffix(e.target.value)}
          placeholder="Enter suffix (e.g., Jr., Sr., III) (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="idNumber">ID Number</Label>
        <Input
          id="idNumber"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="Enter student ID number (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="classSelect">Class *</Label>
        <Select value={classId} onValueChange={setClassId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((classItem) => (
              <SelectItem key={classItem.id} value={classItem.id}>
                {classItem.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="parent">Parent *</Label>
        
        {showAddParent ? (
          // Add Parent Form
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">New Parent Details</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddParent(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="parentName">Parent Name *</Label>
                <Input
                  id="parentName"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  placeholder="Enter parent name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="parentEmail">Email *</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  placeholder="Enter parent email"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Parents need email to log in and check their child's progress
                </p>
              </div>
              <div>
                <Label htmlFor="parentPassword">Password *</Label>
                <Input
                  id="parentPassword"
                  type="password"
                  value={newParentPassword}
                  onChange={(e) => setNewParentPassword(e.target.value)}
                  placeholder="Enter password for parent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a password that the parent can remember easily
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Parent Selection
          <div className="space-y-2">
            {parents.length === 0 ? (
              <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-600 mb-2">No parents available</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddParent(true)}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Parent
                </Button>
              </div>
            ) : (
              <>
                <Select value={parentId} onValueChange={setParentId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent" />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name} {parent.email && `(${parent.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Selected Parent Details */}
                {selectedParent && (
                  <div className="p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Selected Parent:</span>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p><strong>Name:</strong> {selectedParent.name}</p>
                      {selectedParent.email && (
                        <p><strong>Email:</strong> {selectedParent.email}</p>
                      )}
                      {selectedParent.created_at && (
                        <p><strong>Joined:</strong> {new Date(selectedParent.created_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Add New Parent Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddParent(true)}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Parent
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading || (!parentId && !showAddParent) || (showAddParent && (!newParentName.trim() || !newParentEmail.trim() || !newParentPassword.trim()))}
      >
        {loading ? 'Adding Student...' : 'Add Student'}
      </Button>
    </form>
  )
}

// Manage Students Form Component
function ManageStudentsForm({ 
  onSubmit, 
  classId,
  className
}: { 
  onSubmit: (data: { classId: string; studentIds: string[] }) => void
  classId: string
  className: string
}) {
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [existingStudents, setExistingStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchAvailableStudents()
  }, [classId])

  const fetchAvailableStudents = async () => {
    try {
      // First, get all students that are already in this class
      const { data: existingRelationships, error: relationshipError } = await supabase
        .from('student_class')
        .select('student_id')
        .eq('class_id', classId)

      if (relationshipError) {
        console.error('Error fetching existing relationships:', relationshipError)
        // If the table doesn't exist yet, fall back to the old method
        // Check if students are in this class using the class_id field
        const { data: studentsInClass, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .eq('class_id', classId)

        if (studentsError) {
          console.error('Error fetching students in class:', studentsError)
          return
        }

        const existingStudentIds = studentsInClass?.map(s => s.id) || []

        // Fetch all students that are not in this class
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .not('class_id', 'eq', classId)
          .order('name')

        if (error) {
          console.error('Error fetching students:', error)
        } else {
          setExistingStudents(data || [])
        }
        return
      }

      const existingStudentIds = existingRelationships?.map(r => r.student_id) || []

      // Then fetch all students that are not in this class
      let query = supabase
        .from('students')
        .select('*')
        .order('name')

      if (existingStudentIds.length > 0) {
        // Use a simpler approach - fetch all students and filter in JavaScript
        const { data, error } = await query
        
        if (error) {
          console.error('Error fetching students:', error)
          return
        }

        // Filter out students that are already in this class
        const availableStudents = (data || []).filter(student => 
          !existingStudentIds.includes(student.id)
        )
        
        setExistingStudents(availableStudents)
      } else {
        // If no existing relationships, all students are available
        const { data, error } = await query
        
        if (error) {
          console.error('Error fetching students:', error)
        } else {
          setExistingStudents(data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student to add')
      return
    }

    setLoading(true)
    try {
      onSubmit({ classId, studentIds: selectedStudents })
    } catch (error) {
      console.error('Error managing students:', error)
      toast.error('Error adding students to class')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="flex items-center space-x-2 mb-3">
          <Users className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-900">Adding Students to: {className}</span>
        </div>
        <p className="text-sm text-blue-700">
          Select students to add to this class. Students will be moved from their current class (if any) to this class.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Available Students</Label>
        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
          {existingStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No available students found</p>
              <p className="text-sm">All students are already in this class or other classes</p>
            </div>
          ) : (
            existingStudents.map((student) => (
              <label key={student.id} className="flex items-center space-x-3 p-3 rounded hover:bg-gray-50 border-b last:border-b-0">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudents([...selectedStudents, student.id])
                    } else {
                      setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                    }
                  }}
                  className="rounded"
                />
                {student.avatar_url ? (
                  <img 
                    src={student.avatar_url} 
                    alt={`${student.name} avatar`} 
                    className="w-6 h-6 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{student.name}</span>
                    {student.id_number && (
                      <Badge variant="outline" className="text-xs">
                        ID: {student.id_number}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="text-green-600">
                      Available to add to this class
                    </span>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
        
        {selectedStudents.length > 0 && (
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <strong>{selectedStudents.length}</strong> student{selectedStudents.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading || selectedStudents.length === 0}>
          {loading ? 'Adding Students...' : 'Add Selected Students'}
        </Button>
      </div>
    </form>
  )
}

 