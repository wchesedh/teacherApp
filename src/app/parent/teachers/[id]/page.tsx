'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  User, 
  Mail, 
  Calendar,
  BookOpen,
  GraduationCap,
  MessageSquare,
  ArrowLeft,
  Phone,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'

import Link from 'next/link'

interface Teacher {
  id: string
  name: string
  email: string
  created_at?: string
  avatar_url?: string
  bio?: string
  phone?: string
  subjects?: string[]
}

interface Class {
  id: string
  name: string
  students?: Student[]
}

interface Student {
  id: string
  name: string
}

export default function TeacherProfileViewPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    classes: 0,
    students: 0,
    posts: 0
  })
  const hasFetchedData = useRef(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  useEffect(() => {
    if (id && user) {
      // Check if we have cached data in localStorage
      const cacheKey = `teacher-profile-${id}`
      const cachedData = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`)
      
      if (cachedData && cacheTimestamp) {
        const timestamp = parseInt(cacheTimestamp)
        const now = Date.now()
        const cacheAge = now - timestamp
        
        // If cache is less than 5 minutes old, use it
        if (cacheAge < 5 * 60 * 1000) {
          try {
            const parsedData = JSON.parse(cachedData)
            setTeacher(parsedData.teacher)
            setClasses(parsedData.classes)
            setStats(parsedData.stats)
            setLoading(false)
            hasFetchedData.current = true
            setLastFetchTime(timestamp)
            return
          } catch (error) {
            // If parsing fails, clear cache and fetch fresh data
            localStorage.removeItem(cacheKey)
            localStorage.removeItem(`${cacheKey}-timestamp`)
          }
        }
      }
      
      // Only fetch if we haven't fetched recently or don't have cached data
      if (!hasFetchedData.current) {
        hasFetchedData.current = true
        fetchTeacherProfile()
      }
    }
  }, [id, user])

  const fetchTeacherProfile = async () => {
    if (!id || !user) return

    try {
      setLoading(true)

      // Fetch teacher info
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id)
        .single()

      if (teacherError) {
        console.error('Error fetching teacher:', teacherError)
        toast.error('Error fetching teacher profile')
        return
      }

      setTeacher(teacherData)

      // Fetch classes for this teacher
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          name
        `)
        .eq('teacher_id', id)

      let classesWithStudents: any[] = []
      
      if (classesError) {
        console.error('Error fetching classes:', classesError)
        setClasses([])
      } else {
        // Fetch students for each class using the student_class relationship table
        classesWithStudents = await Promise.all(
          (classesData || []).map(async (classItem) => {
            try {
              // First get student IDs from the student_class relationship table
              const { data: studentClassData, error: studentClassError } = await supabase
                .from('student_class')
                .select('student_id')
                .eq('class_id', classItem.id)

              if (studentClassError) {
                console.error(`Error fetching student-class relationships for class ${classItem.id}:`, studentClassError)
                return { ...classItem, students: [] }
              }

              if (!studentClassData || studentClassData.length === 0) {
                return { ...classItem, students: [] }
              }

              // Then fetch the actual student data using the student IDs
              const studentIds = studentClassData.map(sc => sc.student_id)
              const { data: studentsData, error: studentsError } = await supabase
                .from('students')
                .select('id, name')
                .in('id', studentIds)

              if (studentsError) {
                console.error(`Error fetching students for class ${classItem.id}:`, studentsError)
                return { ...classItem, students: [] }
              }

              return {
                ...classItem,
                students: studentsData || []
              }
            } catch (error) {
              console.error(`Error processing class ${classItem.id}:`, error)
              return { ...classItem, students: [] }
            }
          })
        )
        setClasses(classesWithStudents)
      }

      // Fetch stats
      await fetchTeacherStats()

      // Cache the data in localStorage
      try {
        const cacheKey = `teacher-profile-${id}`
        const dataToCache = {
          teacher: teacherData,
          classes: classesWithStudents || [],
          stats: {
            classes: classesData?.length || 0,
            students: 0, // Will be updated after fetchTeacherStats
            posts: 0
          }
        }
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache))
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString())
        setLastFetchTime(Date.now())
      } catch (error) {
        // If localStorage fails, just continue
        console.warn('Failed to cache teacher profile data')
      }

    } catch (error) {
      console.error('Error fetching teacher profile:', error)
      toast.error('Error fetching teacher profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeacherStats = async () => {
    if (!id) return

    try {
      // Fetch classes count for this teacher
      const { count: classesCount, error: classesError } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', id)

             // Fetch unique students count for this teacher's classes using student_class relationship
       const { data: classIds, error: classIdsError } = await supabase
         .from('classes')
         .select('id')
         .eq('teacher_id', id)

       if (classIdsError) {
         console.error('Error fetching class IDs:', classIdsError)
         return
       }

       let totalStudents = 0
       if (classIds && classIds.length > 0) {
         const classIdList = classIds.map(c => c.id)
         
         // Get all student IDs from all classes (this will include duplicates if students are in multiple classes)
         const { data: studentClassData, error: studentClassError } = await supabase
           .from('student_class')
           .select('student_id')
           .in('class_id', classIdList)

         if (studentClassError) {
           console.error('Error fetching student-class relationships:', studentClassError)
         } else if (studentClassData) {
           // Count unique students by creating a Set of unique student IDs
           const uniqueStudentIds = new Set(studentClassData.map(sc => sc.student_id))
           totalStudents = uniqueStudentIds.size
         }
       }

      // Fetch posts count for this teacher
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', id)

             const newStats = {
         classes: classesCount || 0,
         students: totalStudents,
         posts: postsCount || 0
       }
      
      setStats(newStats)

      // Update the cached data with the complete stats
      try {
        const cacheKey = `teacher-profile-${id}`
        const existingCache = localStorage.getItem(cacheKey)
        if (existingCache) {
          const parsedCache = JSON.parse(existingCache)
          const updatedCache = {
            ...parsedCache,
            stats: newStats
          }
          localStorage.setItem(cacheKey, JSON.stringify(updatedCache))
        }
      } catch (error) {
        // If localStorage fails, just continue
        console.warn('Failed to update cached stats')
      }

             // Log any errors for debugging
       if (classesError) console.error('Error fetching classes count:', classesError)
       if (postsError) console.error('Error fetching posts count:', postsError)

    } catch (error) {
      console.error('Error fetching teacher stats:', error)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading teacher profile...</p>
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
            <Link href="/parent/teachers">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teachers
              </Button>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
                          <Link href="/parent/teachers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teachers
              </Button>
            </Link>
            </div>
            
            {/* Manual Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Clear cache and fetch fresh data
                const cacheKey = `teacher-profile-${id}`
                localStorage.removeItem(cacheKey)
                localStorage.removeItem(`${cacheKey}-timestamp`)
                hasFetchedData.current = false
                setLoading(true)
                fetchTeacherProfile()
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Teacher Profile
          </h1>
          <p className="text-gray-600 mt-2">
            View information about {teacher.name}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg mx-auto">
                    {teacher.avatar_url ? (
                      <img 
                        src={teacher.avatar_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {teacher.name}
                    </h3>
                    <p className="text-gray-600">Teacher</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600">{teacher.email}</span>
                  </div>
                  
                  {teacher.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Line ID: {teacher.phone}</span>
                    </div>
                  )}

                  {teacher.bio && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Bio</h4>
                      <p className="text-gray-600 text-sm whitespace-pre-wrap">{teacher.bio}</p>
                    </div>
                  )}
                  
                  {teacher.subjects && teacher.subjects.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Subjects</h4>
                      <div className="flex flex-wrap gap-2">
                        {teacher.subjects.map((subject) => (
                          <Badge key={subject} variant="secondary">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Member Since</h4>
                    <p className="text-gray-600 text-sm">
                      {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats and Classes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.classes}</p>
                      <p className="text-sm text-gray-600">Classes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.students}</p>
                      <p className="text-sm text-gray-600">Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.posts}</p>
                      <p className="text-sm text-gray-600">Posts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Classes Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Classes</span>
                </CardTitle>
                <CardDescription>
                  Classes taught by this teacher
                </CardDescription>
              </CardHeader>
              <CardContent>
                {classes.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes</h3>
                    <p className="text-gray-600">
                      This teacher is not currently assigned to any classes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classes.map((classItem) => (
                      <div key={classItem.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{classItem.name}</h4>
                                                     <Badge variant="secondary">
                             {classItem.students?.length || 0} {classItem.students?.length === 1 ? 'student' : 'students'}
                           </Badge>
                        </div>
                        
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Last Updated Indicator */}
        {lastFetchTime > 0 && (
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(lastFetchTime).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
