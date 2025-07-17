'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Users, BookOpen, GraduationCap, MessageSquare, ChevronDown, ChevronRight, Eye, Trash2, ThumbsUp, Heart, Star, Smile } from 'lucide-react'
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

interface ClassAnnouncement {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
  class?: Class
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

      // Fetch students count for this teacher's classes
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', 
          (await supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', user?.id)
          ).data?.map(c => c.id) || []
        )

      // Fetch parents count for students in this teacher's classes
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('parent_id')
        .in('student_id',
          (await supabase
            .from('students')
            .select('id')
            .in('class_id',
              (await supabase
                .from('classes')
                .select('id')
                .eq('teacher_id', user?.id)
              ).data?.map(c => c.id) || []
            )
          ).data?.map(s => s.id) || []
        )

      // Get unique parent count
      const uniqueParentIds = new Set(studentParentsData?.map(sp => sp.parent_id) || [])
      const parentsCount = uniqueParentIds.size

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
          // Fetch students for this class
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', classItem.id)
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
      description: 'Classes you teach'
    },
    {
      title: 'My Students\' Parents',
      value: stats.parents.toString(),
      icon: Users,
      description: 'Parents of your students'
    },
    {
      title: 'My Students',
      value: stats.students.toString(),
      icon: GraduationCap,
      description: 'Students in your classes'
    },
    {
      title: 'My Posts',
      value: stats.posts.toString(),
      icon: MessageSquare,
      description: 'Posts you\'ve created'
    }
  ]

  const toggleClassExpansion = (classId: string) => {
    setExpandedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
  }

  const handleAddClass = async (classData: { name: string }) => {
    try {
      const { error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          teacher_id: user?.id
        }])

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      await fetchData()
      setIsAddClassOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

  const handleAddStudent = async (studentData: { name: string; class_id: string; parent_id: string }) => {
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

      // First add the student
      const { data: studentResult, error: studentError } = await supabase
        .from('students')
        .insert([{
          name: studentData.name,
          class_id: studentData.class_id
        }])
        .select()

      if (studentError) {
        console.error('Error adding student:', studentError)
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
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) {
      return
    }
    try {
      // Verify the student belongs to one of this teacher's classes
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', studentId)
        .single()
      if (studentError || !studentData) {
        toast.error('Student not found')
        return
      }
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', studentData.class_id)
        .eq('teacher_id', user?.id)
        .single()
      if (classError || !classData) {
        toast.error('You can only delete students from your own classes')
        return
      }
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)
      if (error) {
        console.error('Error deleting student:', error)
        toast.error('Error deleting student: ' + error.message)
      } else {
        await fetchData()
        toast.success('Student deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting student:', error)
      toast.error('Error deleting student')
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
            <Card key={index}>
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
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Recent Class Announcements</span>
              </CardTitle>
              <CardDescription>
                Your recent class-wide announcements and parent reactions
              </CardDescription>
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
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap text-sm mb-3">{announcement.content}</p>
                    
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
                {classAnnouncements.length > 3 && (
                  <div className="text-center pt-4">
                    <Button variant="outline" size="sm">
                      View All Announcements
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classes Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>My Classes</CardTitle>
                <CardDescription>
                  Manage your classes and their students ({classes.length} classes)
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddClassOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No classes yet. Create your first class to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {classes.map((classItem) => (
                  <div key={classItem.id} className="border rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleClassExpansion(classItem.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {expandedClasses.includes(classItem.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <div>
                          <h3 className="font-medium">{classItem.name}</h3>
                          <p className="text-sm text-gray-500">
                            {classItem.students?.length || 0} students
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/teacher/classes/${classItem.id}/posts`}>
                          <Button size="sm" variant="outline">
                            Announcements
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedClassForStudent(classItem.id)
                            setIsAddStudentOpen(true)
                          }}
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Add Student
                        </Button>
                      </div>
                    </div>
                    
                    {expandedClasses.includes(classItem.id) && (
                      <div className="border-t bg-gray-50 p-4">
                        {classItem.students && classItem.students.length > 0 ? (
                          <div className="space-y-3">
                                                         {classItem.students.map((student) => (
                               <div key={student.id} className="bg-white p-3 rounded border">
                                 <div className="flex items-center justify-between">
                                   <div>
                                     <h4 className="font-medium">{student.name}</h4>
                                     {student.parents && student.parents.length > 0 ? (
                                       <div className="text-sm text-gray-500 mt-1">
                                         Parents: {student.parents.map(p => p.name).join(', ')}
                                       </div>
                                     ) : (
                                       <div className="text-sm text-gray-400 mt-1">No parents assigned</div>
                                     )}
                                   </div>
                                   <div className="flex gap-2">
                                     <Link href={`/teacher/students/${student.id}`}>
                                       <Button size="sm" variant="outline">
                                         <Eye className="w-4 h-4 mr-1" />
                                         View Details
                                       </Button>
                                     </Link>
                                     <Button size="sm" variant="destructive" onClick={() => handleDeleteStudent(student.id)}>
                                       <Trash2 className="w-4 h-4 mr-1" />
                                       Delete
                                     </Button>
                                   </div>
                                 </div>
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            No students in this class yet.
                          </div>
                        )}
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
function AddClassForm({ onSubmit }: { onSubmit: (data: { name: string }) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    onSubmit({ name: name.trim() })
    setName('')
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
      <div className="flex justify-end space-x-2">
        <Button type="submit">
          Create Class
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
  onSubmit: (data: { name: string; class_id: string; parent_id: string }) => void
  selectedClassId: string
  classes: Class[]
  onParentCreated?: (credentials: { email: string; password: string }) => void
}) {
  const [name, setName] = useState('')
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
    if (!name.trim()) {
      toast.error('Please enter a student name')
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
              name: name.trim(), 
              class_id: classId, 
              parent_id: existingParent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setName('')
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
              name: name.trim(), 
              class_id: classId, 
              parent_id: result.parent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setName('')
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
      await onSubmit({ name: name.trim(), class_id: classId, parent_id: parentId })
      setName('')
      setParentId('')
      setLoading(false)
    }
  }

  const selectedParent = parents.find(p => p.id === parentId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Student Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter student name"
          required
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

 