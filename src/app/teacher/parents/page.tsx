'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Mail, 
  Calendar, 
  Eye, 
  EyeOff,
  Copy,
  Search,
  Plus
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Layout from '@/components/Layout'
import { toast } from 'sonner'

interface Parent {
  id: string
  name: string
  email: string | null
  password?: string
  created_at: string
  students?: Student[]
}

interface Student {
  id: string
  name: string
  class_id: string
  created_at: string
  class?: Class
}

interface Class {
  id: string
  name: string
  teacher_id: string
}

export default function TeacherParentsPage() {
  const { user } = useAuth()
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    if (user) {
      fetchParents()
    }
  }, [user])

  const fetchParents = async () => {
    try {
      setLoading(true)
      console.log('Fetching parents for teacher:', user?.id)

      // Get all students in this teacher's classes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .in('class_id', 
          (await supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', user?.id)
          ).data?.map(c => c.id) || []
        )

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        toast.error('Error loading students')
        return
      }

      // Get parent IDs for these students
      const studentIds = studentsData?.map(s => s.id) || []
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('parent_id')
        .in('student_id', studentIds)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error loading parent relationships')
        return
      }

      // Get unique parent IDs
      const uniqueParentIds = [...new Set(studentParentsData?.map(sp => sp.parent_id) || [])]

      if (uniqueParentIds.length === 0) {
        setParents([])
        return
      }

      // Fetch parent details
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')
        .in('id', uniqueParentIds)
        .order('created_at', { ascending: false })

      if (parentsError) {
        console.error('Error fetching parents:', parentsError)
        toast.error('Error loading parents')
        return
      }

      // Fetch students for each parent
      const parentsWithStudents = await Promise.all(
        (parentsData || []).map(async (parent) => {
          const { data: parentStudentsData, error: parentStudentsError } = await supabase
            .from('student_parent')
            .select(`
              student_id,
              students (
                id,
                name,
                class_id,
                created_at,
                classes (
                  id,
                  name,
                  teacher_id
                )
              )
            `)
            .eq('parent_id', parent.id)

          if (parentStudentsError) {
            console.error('Error fetching students for parent:', parent.id, parentStudentsError)
            return { ...parent, students: [] }
          }

          const students = parentStudentsData?.map((sp: any) => ({
            id: sp.students.id,
            name: sp.students.name,
            class_id: sp.students.class_id,
            created_at: sp.students.created_at,
            class: sp.students.classes
          })) || []

          return { ...parent, students }
        })
      )

      setParents(parentsWithStudents)

    } catch (error) {
      console.error('Error fetching parents:', error)
      toast.error('Error loading parents')
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = (parentId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [parentId]: !prev[parentId]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }



  const filteredParents = parents.filter(parent =>
    parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (parent.email && parent.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading parents...</p>
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
            Parent Management
          </h1>
          <p className="text-gray-600 mt-2">
            View and manage parents of your students
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search parents by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Parents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Parents ({filteredParents.length})</span>
            </CardTitle>
            <CardDescription>
              Parents of students in your classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredParents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Parents Found</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'No parents match your search.' : 'No parents have been added yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredParents.map((parent) => (
                  <Card key={parent.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{parent.name}</h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span>{parent.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Children */}
                        {parent.students && parent.students.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Children:</h4>
                            <div className="flex flex-wrap gap-2">
                              {parent.students.map((student) => (
                                <Badge key={student.id} variant="secondary">
                                  {student.name} {student.class && `(${student.class.name})`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Login Credentials */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Login Credentials:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">Email:</span>
                              <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                                {parent.email}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(parent.email || '')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                                                         <div className="flex items-center space-x-2">
                               <span className="text-sm text-gray-600">Password:</span>
                               {parent.password ? (
                                 <>
                                   <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                                     {showPasswords[parent.id] ? parent.password : '••••••••'}
                                   </span>
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     onClick={() => togglePasswordVisibility(parent.id)}
                                   >
                                     {showPasswords[parent.id] ? (
                                       <EyeOff className="w-3 h-3" />
                                     ) : (
                                       <Eye className="w-3 h-3" />
                                     )}
                                   </Button>
                                   <Button
                                     size="sm"
                                     variant="ghost"
                                     onClick={() => copyToClipboard(parent.password || '')}
                                   >
                                     <Copy className="w-3 h-3" />
                                   </Button>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-sm text-gray-500 italic">No password stored</span>
                                 </>
                               )}
                             </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mt-3 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>Added: {new Date(parent.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
} 