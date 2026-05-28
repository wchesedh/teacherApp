'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Users, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface ClassItem {
  id: string
  name: string
  teacher_id: string
}

interface Student {
  id: string
  name: string
  id_number?: string
  created_at: string
}

export default function TeacherClassStudentsPage() {
  const params = useParams()
  const classId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [classItem, setClassItem] = useState<ClassItem | null>(null)
  const [students, setStudents] = useState<Student[]>([])

  useEffect(() => {
    if (!authLoading && user && classId) {
      fetchClassStudents()
    }
  }, [authLoading, user, classId])

  const fetchClassStudents = async () => {
    try {
      setLoading(true)

      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name, teacher_id')
        .eq('id', classId)
        .eq('teacher_id', user?.id)
        .single()

      if (classError || !classData) {
        toast.error('Class not found')
        setClassItem(null)
        setStudents([])
        return
      }

      setClassItem(classData)

      const { data: studentClassRows, error: studentClassError } = await supabase
        .from('student_class')
        .select(`
          student_id,
          students!student_class_student_id_fkey (
            id,
            name,
            id_number,
            created_at
          )
        `)
        .eq('class_id', classId)

      if (studentClassError) {
        console.error('Error loading class students via student_class:', studentClassError)
        const { data: fallbackStudents, error: fallbackError } = await supabase
          .from('students')
          .select('id, name, id_number, created_at')
          .eq('class_id', classId)
          .order('created_at', { ascending: false })

        if (fallbackError) {
          console.error('Fallback student load failed:', fallbackError)
          toast.error('Error loading students')
          return
        }

        setStudents(fallbackStudents || [])
        return
      }

      const mapped = (studentClassRows || [])
        .map((row: any) => row.students)
        .filter(Boolean)

      const uniqueStudents = mapped.filter(
        (student: Student, index: number, self: Student[]) =>
          index === self.findIndex((s) => s.id === student.id)
      )

      setStudents(uniqueStudents)
    } catch (error) {
      console.error('Error loading class students:', error)
      toast.error('Error loading class students')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher/classes" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {classItem ? `${classItem.name} Students` : 'Class Students'}
              </h1>
              <p className="text-gray-600">View all students in this class</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/teacher/classes/${classId}/posts`}>View Announcements</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students ({students.length})
            </CardTitle>
            <CardDescription>Students currently linked to this class</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-600">Loading students...</div>
            ) : !classItem ? (
              <div className="py-8 text-center text-gray-600">
                Class not found or you do not have access.
              </div>
            ) : students.length === 0 ? (
              <div className="py-8 text-center text-gray-600">No students in this class yet.</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.id_number || 'Not assigned'}</TableCell>
                        <TableCell>{new Date(student.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/teacher/students/${student.id}?classId=${classId}`}>
                              View Student
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
