'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  GraduationCap, 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  ArrowLeft,
  BookOpen
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
}

interface Class {
  id: string
  name: string
  teacher_id: string
  teacher?: Teacher
}

interface Teacher {
  id: string
  name: string
  email: string
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at: string
}

interface Post {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
}

export default function AdminStudentProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const studentId = params.id as string
  
  const [student, setStudent] = useState<Student | null>(null)
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [parents, setParents] = useState<Parent[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

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

      setStudent(studentData)

      // Fetch class information
      if (studentData.class_id) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select(`
            *,
            teachers (
              id,
              name,
              email
            )
          `)
          .eq('id', studentData.class_id)
          .single()

        if (classError) {
          console.error('Error fetching class:', classError)
        } else {
          setClassInfo(classData)
        }
      }

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
            setParents(parentsData || [])
          }
        }
      }

      // Fetch posts for this student
      const { data: tagData, error: tagError } = await supabase
        .from('post_student_tags')
        .select(`
          post_id,
          posts (
            id,
            content,
            created_at,
            teachers (
              id,
              name,
              email
            )
          )
        `)
        .eq('student_id', studentId)

      if (tagError) {
        console.error('Error fetching post tags:', tagError)
        setPosts([])
      } else if (tagData && tagData.length > 0) {
        // Transform posts data
        const postsData = tagData.map((item: any) => ({
          id: item.posts.id,
          content: item.posts.content,
          created_at: item.posts.created_at,
          teacher: item.posts.teachers
        }))
        
        setPosts(postsData)
      } else {
        setPosts([])
      }

    } catch (error) {
      console.error('Error fetching student details:', error)
      toast.error('Error fetching student details')
    } finally {
      setLoading(false)
    }
  }

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
            <Link href="/admin/students" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to Students
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
            <Link href="/admin/students" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {student.name}'s Profile
              </h1>
              <p className="text-gray-600 mt-2">
                View student details and progress updates
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Student Information */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5" />
                  <span>Student Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{student.name}</h3>
                      <p className="text-sm text-gray-500">Student</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Joined:</span>
                      <span className="text-sm font-medium">
                        {new Date(student.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Class Information */}
            {classInfo && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5" />
                    <span>Class Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Class:</span>
                      <span className="text-sm font-medium">{classInfo.name}</span>
                    </div>
                    
                    {classInfo.teacher && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Teacher:</span>
                        <span className="text-sm font-medium">{classInfo.teacher.name}</span>
                        {classInfo.teacher.email && (
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{classInfo.teacher.email}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Parents Information */}
            {parents.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Parents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {parents.map((parent) => (
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

          {/* Progress Updates Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Progress Updates</span>
                </CardTitle>
                <CardDescription>
                  All posts about {student.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {posts.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Updates Yet</h3>
                    <p className="text-gray-600">
                      Teachers will post updates about {student.name}'s progress here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {post.teacher && (
                              <span className="text-sm font-medium text-blue-600">
                                {post.teacher.name}
                              </span>
                            )}
                          </div>
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
          </div>
        </div>
      </div>
    </Layout>
  )
} 