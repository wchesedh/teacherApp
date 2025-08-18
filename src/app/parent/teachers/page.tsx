'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  MessageSquare,
  Search,
  User,
  Mail,
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
  classes?: Class[]
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

export default function TeachersPage() {
  const { user } = useAuth()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const hasFetchedData = useRef(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  useEffect(() => {
    if (user) {
      // Check if we have cached data in localStorage
      const cachedData = localStorage.getItem('teachers-cache')
      const cacheTimestamp = localStorage.getItem('teachers-cache-timestamp')
      
      if (cachedData && cacheTimestamp) {
        const timestamp = parseInt(cacheTimestamp)
        const now = Date.now()
        const cacheAge = now - timestamp
        
        // If cache is less than 5 minutes old, use it
        if (cacheAge < 5 * 60 * 1000) {
          try {
            const parsedData = JSON.parse(cachedData)
            setTeachers(parsedData)
            setFilteredTeachers(parsedData)
            setLoading(false)
            hasFetchedData.current = true
            setLastFetchTime(timestamp)
            return
          } catch (error) {
            // If parsing fails, clear cache and fetch fresh data
            localStorage.removeItem('teachers-cache')
            localStorage.removeItem('teachers-cache-timestamp')
          }
        }
      }
      
      // Only fetch if we haven't fetched recently or don't have cached data
      if (!hasFetchedData.current) {
        hasFetchedData.current = true
        fetchTeachers()
      }
    }
  }, [user])

  useEffect(() => {
    filterTeachers()
  }, [searchTerm, selectedSubject, teachers])

  const fetchTeachers = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch teachers data
      
             // Now try the full query
       const { data: teachersData, error: teachersError } = await supabase
         .from('teachers')
         .select('*')
         .order('name', { ascending: true })



      if (teachersError) {

        toast.error(`Error fetching teachers: ${teachersError.message || 'Unknown error'}`)
        return
      }

      if (!teachersData || teachersData.length === 0) {

        setTeachers([])
        return
      }

      // Now fetch classes and student counts for each teacher
       
       const teachersWithClasses = await Promise.all(
         teachersData.map(async (teacher) => {
           try {
             // Fetch classes for this teacher
             const { data: classesData, error: classesError } = await supabase
               .from('classes')
               .select('id, name')
               .eq('teacher_id', teacher.id)

             if (classesError) {
               return { ...teacher, classes: [] }
             }

             // Fetch student counts for each class
             const classesWithStudentCounts = await Promise.all(
               (classesData || []).map(async (classItem) => {
                 try {
                   const { count: studentCount, error: studentCountError } = await supabase
                     .from('students')
                     .select('*', { count: 'exact', head: true })
                     .eq('class_id', classItem.id)

                   if (studentCountError) {
                     return { ...classItem, students: [] }
                   }

                   return {
                     ...classItem,
                     students: Array(studentCount || 0).fill({ id: 'placeholder', name: 'Student' })
                   }
                 } catch (error) {
                   return { ...classItem, students: [] }
                 }
               })
             )

             return {
               ...teacher,
               classes: classesWithStudentCounts
             }
           } catch (error) {
             return { ...teacher, classes: [] }
           }
         })
       )

               setTeachers(teachersWithClasses)
        
        // Cache the data in localStorage
        try {
          localStorage.setItem('teachers-cache', JSON.stringify(teachersWithClasses))
          localStorage.setItem('teachers-cache-timestamp', Date.now().toString())
          setLastFetchTime(Date.now())
        } catch (error) {
          // If localStorage fails, just continue
          console.warn('Failed to cache teachers data')
        }

    } catch (error: any) {
      // Show a more specific error message
      if (error.message?.includes('fetch')) {
        toast.error('Network error: Unable to connect to the database')
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        toast.error('Permission denied: You may not have access to view teachers')
      } else {
        toast.error(`Error fetching teachers: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const filterTeachers = () => {
    let filtered = teachers

          // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(teacher => {
          const searchLower = searchTerm.toLowerCase()
          return (
            teacher.name.toLowerCase().includes(searchLower) ||
            teacher.email.toLowerCase().includes(searchLower) ||
            (teacher.subjects && teacher.subjects.some(subject => 
              subject.toLowerCase().includes(searchLower)
            ))
          )
        })
      }

    // Filter by subject
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(teacher => 
        teacher.subjects && teacher.subjects.includes(selectedSubject)
      )
    }

    setFilteredTeachers(filtered)
  }

  const getUniqueSubjects = () => {
    const subjects = new Set<string>()
    teachers.forEach(teacher => {
      if (teacher.subjects) {
        teacher.subjects.forEach(subject => subjects.add(subject))
      }
    })
    return Array.from(subjects).sort()
  }

  const getTeacherStats = (teacher: Teacher) => {
    const classCount = teacher.classes?.length || 0
    const studentCount = teacher.classes?.reduce((total, classItem) => 
      total + (classItem.students?.length || 0), 0
    ) || 0
    return { classCount, studentCount }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading teachers...</p>
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
            Teachers
          </h1>
          <p className="text-gray-600 mt-2">
            View information about your children's teachers
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search teachers by name, email, or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
                          <div className="sm:w-48">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Subjects</option>
                  {getUniqueSubjects().map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
                         {/* Manual Refresh Button */}
             <Button
               variant="outline"
               size="sm"
               onClick={() => {
                 // Clear cache and fetch fresh data
                 localStorage.removeItem('teachers-cache')
                 localStorage.removeItem('teachers-cache-timestamp')
                 hasFetchedData.current = false
                 setLoading(true)
                 fetchTeachers()
               }}
               className="flex items-center gap-2"
             >
               <RefreshCw className="w-4 h-4" />
               Refresh
             </Button>
          </div>
        </div>

        {/* Teachers Grid */}
        {filteredTeachers.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || selectedSubject !== 'all' ? 'No teachers found' : 'No teachers available'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || selectedSubject !== 'all' 
                    ? 'Try adjusting your search criteria or filters.'
                    : 'There are no teachers currently registered in the system.'
                  }
                </p>
                {(searchTerm || selectedSubject !== 'all') && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedSubject('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeachers.map((teacher) => {
              const stats = getTeacherStats(teacher)
              return (
                <Card key={teacher.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-md flex-shrink-0">
                        {teacher.avatar_url ? (
                          <img 
                            src={teacher.avatar_url} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight">
                          {teacher.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Teacher
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600 truncate">{teacher.email}</span>
                      </div>
                      {teacher.phone && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">Line ID: {teacher.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Bio */}
                    {teacher.bio && (
                      <div>
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {teacher.bio}
                        </p>
                      </div>
                    )}

                    {/* Subjects */}
                    {teacher.subjects && teacher.subjects.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Subjects</h4>
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects.slice(0, 3).map((subject) => (
                            <Badge key={subject} variant="secondary" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                          {teacher.subjects.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{teacher.subjects.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 text-blue-600">
                          <BookOpen className="w-4 h-4" />
                          <span className="text-lg font-semibold">{stats.classCount}</span>
                        </div>
                        <p className="text-xs text-gray-600">Classes</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-1 text-green-600">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-lg font-semibold">{stats.studentCount}</span>
                        </div>
                        <p className="text-xs text-gray-600">Students</p>
                      </div>
                    </div>

                    {/* View Profile Button */}
                    <div className="pt-2">
                      <Link href={`/parent/teachers/${teacher.id}`}>
                        <Button className="w-full" size="sm">
                          <User className="w-4 h-4 mr-2" />
                          View Profile
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

                 {/* Results Summary */}
         {filteredTeachers.length > 0 && (
           <div className="mt-8 text-center space-y-2">
             <p className="text-sm text-gray-600">
               Showing {filteredTeachers.length} of {teachers.length} teachers
               {(searchTerm || selectedSubject !== 'all') && ' (filtered)'}
             </p>
             {lastFetchTime > 0 && (
               <p className="text-xs text-gray-500">
                 Last updated: {new Date(lastFetchTime).toLocaleTimeString()}
               </p>
             )}
           </div>
         )}
      </div>
    </Layout>
  )
}
