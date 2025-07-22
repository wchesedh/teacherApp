'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  BookOpen, 
  User, 
  Calendar,
  Eye,
  ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Child {
  id: string
  name: string
  id_number?: string
  created_at: string
  class_id: string | null
  avatar_url?: string
  class?: Class
  allClasses?: Class[]
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

export default function ParentChildrenPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchChildren()
    }
  }, [user])

  const fetchChildren = async () => {
    if (!user) {
      console.log('User not loaded yet, skipping fetchChildren')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Fetching children for parent:', user.email)

      // Get children linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', user.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error fetching children')
        return
      }

      if (!studentParentsData || studentParentsData.length === 0) {
        setChildren([])
        setLoading(false)
        return
      }

      const studentIds = studentParentsData.map(sp => sp.student_id)
      console.log('Student IDs to fetch:', studentIds)

      // Fetch students first
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, id_number, created_at, avatar_url')
        .in('id', studentIds)

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        toast.error('Error fetching children')
        return
      }

      // Fetch class relationships for these students
      const { data: classRelationships, error: classError } = await supabase
        .from('student_class')
        .select('student_id, class_id')
        .in('student_id', studentIds)

      if (classError) {
        console.error('Error fetching class relationships:', classError)
        toast.error('Error fetching children')
        return
      }

      // Get unique class IDs
      const classIds = [...new Set(classRelationships?.map(cr => cr.class_id) || [])]
      console.log('Class IDs:', classIds)

      // Fetch classes with teachers
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          teacher_id,
          teachers (
            id,
            name,
            email
          )
        `)
        .in('id', classIds)

      if (classesError) {
        console.error('Error fetching classes:', classesError)
        toast.error('Error fetching children')
        return
      }

      // Create a map of class data
      const classMap = new Map()
      classesData?.forEach(cls => {
        classMap.set(cls.id, cls)
      })

      // Transform the data to combine students with their classes
      const transformedChildren = studentsData?.map((student: any) => {
        // Find all classes for this student
        const studentClasses = classRelationships?.filter(cr => cr.student_id === student.id) || []
        const classData = studentClasses.map(cr => classMap.get(cr.class_id)).filter(Boolean)
        
        // Concatenate all class names
        const classNames = classData.map(cls => cls.name).join(', ')
        
        // Use the first class for backward compatibility
        const primaryClass = classData[0]
        
        return {
          id: student.id,
          name: student.name,
          id_number: student.id_number,
          created_at: student.created_at,
          avatar_url: student.avatar_url,
          class_id: primaryClass?.id || null,
          class: primaryClass ? {
            id: primaryClass.id,
            name: classNames, // Use concatenated class names
            teacher_id: primaryClass.teacher_id,
            teacher: primaryClass.teachers
          } : undefined,
          allClasses: classData // Store all classes for future use
        }
      }) || []

      console.log('Students data:', studentsData)
      console.log('Class relationships:', classRelationships)
      console.log('Classes data:', classesData)
      console.log('Transformed children data:', transformedChildren)

      setChildren(transformedChildren)

    } catch (error) {
      console.error('Error fetching children:', error)
      toast.error('Error fetching children')
    } finally {
      setLoading(false)
    }
  }

  const handleViewChildDetails = (childId: string) => {
    router.push(`/parent/children/${childId}`)
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading your children...</p>
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
            My Children
          </h1>
          <p className="text-gray-600 mt-2">
            View information about your children and their classes
          </p>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Found</h3>
                <p className="text-gray-600">
                  Your children haven't been linked to your account yet. Please contact the school administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Card key={child.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {child.avatar_url ? (
                        <img 
                          src={child.avatar_url} 
                          alt={`${child.name} avatar`} 
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{child.name}</CardTitle>
                        <CardDescription>
                          {child.id_number && (
                            <Badge variant="default" className="mr-2">
                              ID: {child.id_number}
                            </Badge>
                          )}
                          Joined {new Date(child.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewChildDetails(child.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {child.class ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Class:</span>
                        <span className="text-sm font-medium">{child.class.name}</span>
                      </div>
                      
                      {child.class.teacher && (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Teacher:</span>
                          <span className="text-sm font-medium">{child.class.teacher.name}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">Not assigned to a class yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
} 