'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  User, 
  GraduationCap,
  Calendar,
  Eye,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Class {
  id: string
  name: string
  created_at: string
  teacher_id: string
  teacher?: Teacher
  children?: Child[]
}

interface Teacher {
  id: string
  name: string
  email: string
}

interface Child {
  id: string
  name: string
  created_at: string
}

export default function ParentClassesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  
  // Add ref to track if data has been fetched
  const hasFetchedData = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (user && !hasFetchedData.current) {
      hasFetchedData.current = true
      fetchClasses()
    } else if (!user) {
      // Reset the ref when user is null
      hasFetchedData.current = false
    }
  }, [user])

  // Add a function to manually refresh data
  const refreshData = () => {
    hasFetchedData.current = false
    fetchClasses()
  }

  // Add visibility change listener to refresh data when tab becomes visible
  useEffect(() => {
    let lastHiddenTime: number | null = null

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenTime = Date.now()
      } else if (!document.hidden && user && hasFetchedData.current && lastHiddenTime) {
        // Only refresh if we've been away for more than 10 minutes
        const timeSinceHidden = Date.now() - lastHiddenTime
        if (timeSinceHidden > 10 * 60 * 1000) { // 10 minutes
          console.log('Tab became visible after being hidden for', timeSinceHidden / 1000 / 60, 'minutes, refreshing classes data')
          refreshData()
        }
        lastHiddenTime = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user])

  const fetchClasses = async () => {
    if (!user) {
      console.log('User not loaded yet, skipping fetchClasses')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Fetching classes for parent:', user.email)
      
      // Store the current fetch time
      sessionStorage.setItem('lastClassesFetch', Date.now().toString())

      // Get children linked to this parent
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', user.id)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error fetching classes')
        return
      }

      if (!studentParentsData || studentParentsData.length === 0) {
        setClasses([])
        setLoading(false)
        return
      }

      const studentIds = studentParentsData.map(sp => sp.student_id)

      // Fetch class relationships for these students using student_class table
      const { data: classRelationships, error: classError } = await supabase
        .from('student_class')
        .select('student_id, class_id')
        .in('student_id', studentIds)

      if (classError) {
        console.error('Error fetching class relationships:', classError)
        toast.error('Error fetching classes')
        return
      }

      // Get unique class IDs from student_class relationships
      const classIds = [...new Set(classRelationships?.map(cr => cr.class_id) || [])]

      if (classIds.length === 0) {
        setClasses([])
        setLoading(false)
        return
      }

      // Fetch classes with teacher information
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          created_at,
          teacher_id,
          teachers (
            id,
            name,
            email
          )
        `)
        .in('id', classIds)
        .order('created_at', { ascending: false })

      if (classesError) {
        console.error('Error fetching classes:', classesError)
        toast.error('Error fetching classes')
        return
      }

      // For each class, get the children enrolled using student_class relationships
      const classesWithChildren = await Promise.all(
        (classesData || []).map(async (classItem: any) => {
          // Find students enrolled in this class using student_class table
          const classStudentIds = classRelationships
            ?.filter(cr => cr.class_id === classItem.id)
            .map(cr => cr.student_id) || []

          if (classStudentIds.length === 0) {
            return {
              id: classItem.id,
              name: classItem.name,
              created_at: classItem.created_at,
              teacher_id: classItem.teacher_id,
              teacher: classItem.teachers,
              children: []
            }
          }

          // Fetch student details for children in this class
          const { data: childrenData, error: childrenError } = await supabase
            .from('students')
            .select('id, name, created_at')
            .in('id', classStudentIds)

          if (childrenError) {
            console.error('Error fetching children for class:', classItem.id, childrenError)
            return {
              id: classItem.id,
              name: classItem.name,
              created_at: classItem.created_at,
              teacher_id: classItem.teacher_id,
              teacher: classItem.teachers,
              children: []
            }
          }

          return {
            id: classItem.id,
            name: classItem.name,
            created_at: classItem.created_at,
            teacher_id: classItem.teacher_id,
            teacher: classItem.teachers,
            children: childrenData || []
          }
        })
      )

      setClasses(classesWithChildren)

    } catch (error) {
      console.error('Error fetching classes:', error)
      toast.error('Error fetching classes')
    } finally {
      setLoading(false)
    }
  }

  const handleViewClassDetails = (classItem: Class) => {
    // Find the first child in this class and redirect to their details
    if (classItem.children && classItem.children.length > 0) {
      const firstChild = classItem.children[0]
      router.push(`/parent/children/${firstChild.id}?classId=${classItem.id}`)
    } else {
      // If no children in this class, redirect to the general children page
      router.push('/parent/children')
    }
  }

  if (loading && !hasFetchedData.current && isClient) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading classes...</p>
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
                My Children's Classes
              </h1>
              <p className="text-gray-600 mt-2">
                View classes where your children are enrolled
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {loading && hasFetchedData.current && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Refreshing...</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                className="text-xs"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {classes.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
                <p className="text-gray-600">
                  Your children aren't enrolled in any classes yet. Please contact the school administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card key={classItem.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <CardDescription>
                          Created {new Date(classItem.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewClassDetails(classItem)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {classItem.teacher && (
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Teacher:</span>
                        <span className="text-sm font-medium">{classItem.teacher.name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Your Children:</span>
                      <Badge variant="secondary">
                        {classItem.children?.length || 0}
                      </Badge>
                    </div>
                    
                    {classItem.children && classItem.children.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">Enrolled:</p>
                        <div className="space-y-1">
                          {classItem.children.map((child) => (
                            <div key={child.id} className="flex items-center space-x-2 text-sm">
                              <GraduationCap className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-700">{child.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
} 