'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User, 
  BookOpen, 
  GraduationCap, 
  Users, 
  Mail, 
  Calendar,
  MessageSquare,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'

interface Teacher {
  id: string
  name: string
  email: string
  created_at?: string
}

interface Class {
  id: string
  name: string
  teacher_id: string
  created_at?: string
  students?: Student[]
}

interface Student {
  id: string
  name: string
  class_id: string | null
  created_at?: string
  parents?: Parent[]
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at?: string
}

interface Post {
  id: string
  content: string
  created_at: string
}

export default function TeacherProfilePage() {
  const { user } = useAuth()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClasses, setExpandedClasses] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      fetchTeacherProfile()
    }
  }, [user])

  const fetchTeacherProfile = async () => {
    if (!user) {
      console.log('User not loaded yet, skipping fetchTeacherProfile')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Fetching teacher profile for:', user.email)

      // Fetch teacher info
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', user.id)
        .single()

      if (teacherError) {
        console.error('Error fetching teacher:', teacherError)
        toast.error('Error fetching teacher profile')
        return
      }

      setTeacher(teacherData)

      // Fetch teacher's classes with students
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (classesError) {
        console.error('Error fetching classes:', classesError)
      } else {
        // Fetch students for each class
        const classesWithStudents = await Promise.all(
          (classesData || []).map(async (classItem) => {
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

        setClasses(classesWithStudents)
      }

      // Fetch teacher's posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (postsError) {
        console.error('Error fetching posts:', postsError)
      } else {
        setPosts(postsData || [])
      }

    } catch (error) {
      console.error('Error fetching teacher profile:', error)
      toast.error('Error fetching teacher profile')
    } finally {
      setLoading(false)
    }
  }

  const toggleClassExpansion = (classId: string) => {
    setExpandedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    )
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading your profile...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!teacher) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Teacher profile not found</p>
          </div>
        </div>
      </Layout>
    )
  }

  const totalStudents = classes.reduce((total, classItem) => total + (classItem.students?.length || 0), 0)
  const totalParents = new Set(
    classes.flatMap(classItem => 
      classItem.students?.flatMap(student => 
        student.parents?.map(parent => parent.id) || []
      ) || []
    )
  ).size

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            My Profile
          </h1>
          <p className="text-gray-600 mt-2">
            View your teaching profile and activities
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Teacher Information */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Teacher Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{teacher.name}</h3>
                      <p className="text-sm text-gray-500">Teacher</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium">{teacher.email}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Joined:</span>
                      <span className="text-sm font-medium">
                        {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>My Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Classes</span>
                    </div>
                    <Badge variant="secondary">{classes.length}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">Students</span>
                    </div>
                    <Badge variant="secondary">{totalStudents}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-600">Parents</span>
                    </div>
                    <Badge variant="secondary">{totalParents}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-gray-600">Posts</span>
                    </div>
                    <Badge variant="secondary">{posts.length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Classes and Activities */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="classes" className="space-y-4">
              <TabsList>
                <TabsTrigger value="classes">My Classes</TabsTrigger>
                <TabsTrigger value="posts">My Posts</TabsTrigger>
              </TabsList>

              <TabsContent value="classes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5" />
                      <span>My Classes</span>
                    </CardTitle>
                    <CardDescription>
                      Manage your classes and students
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {classes.length === 0 ? (
                      <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Yet</h3>
                        <p className="text-gray-600">
                          You haven't created any classes yet. Start by creating your first class.
                        </p>
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
              </TabsContent>

              <TabsContent value="posts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <MessageSquare className="w-5 h-5" />
                      <span>My Posts</span>
                    </CardTitle>
                    <CardDescription>
                      Recent updates you've shared with parents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {posts.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Posts Yet</h3>
                        <p className="text-gray-600">
                          You haven't created any posts yet. Start sharing updates with parents.
                        </p>
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
                            <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  )
} 