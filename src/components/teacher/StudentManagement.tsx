'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface Student {
  id: string
  name: string
  class_id: string | null
  created_at: string
}

interface Class {
  id: string
  name: string
}

interface Parent {
  id: string
  name: string
}

export default function StudentManagement() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    if (!user) {
      console.log('User not loaded yet, skipping fetchData')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
      
      if (classesError) {
        console.error('Error fetching classes:', classesError)
        toast.error('Error fetching classes')
        return
      }
      
      setClasses(classesData || [])
      
      const classIds = classesData?.map(c => c.id) || []
      
      if (classIds.length === 0) {
        setStudents([])
        setParents([])
        setLoading(false)
        return
      }

      // Fetch students in teacher's classes
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
      
      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        toast.error('Error fetching students')
      } else {
        setStudents(studentsData || [])
      }
      
      // Get parent IDs for students in teacher's classes
      const studentIds = studentsData?.map(s => s.id) || []
      
      if (studentIds.length > 0) {
        const { data: studentParents, error: studentParentsError } = await supabase
          .from('student_parent')
          .select('parent_id')
          .in('student_id', studentIds)
        
        if (studentParentsError) {
          console.error('Error fetching student-parent relationships:', studentParentsError)
        } else {
          const parentIds = [...new Set(studentParents?.map(sp => sp.parent_id) || [])]
          
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
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error fetching data')
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      setIsAddDialogOpen(false)
      toast.success('Student created successfully!')
    } catch (error) {
      console.error('Error adding student:', error)
      toast.error('Error creating student')
    }
  }

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

  const getClassName = (classId: string | null) => {
    if (!classId) return 'Not assigned'
    const classItem = classes.find(c => c.id === classId)
    return classItem ? classItem.name : 'Unknown class'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>My Students</CardTitle>
            <CardDescription>
              Students in your classes ({students.length} students)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Add a new student and assign them to a class and parent
                </DialogDescription>
              </DialogHeader>
              <AddStudentForm 
                onSubmit={handleAddStudent} 
                classes={classes}
                parents={parents}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No students found. Add your first student using the "Add Student" button above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.name}
                    </TableCell>
                    <TableCell>
                      {getClassName(student.class_id)}
                    </TableCell>
                    <TableCell>
                      {new Date(student.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Student
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteStudent(student.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Student
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// Add Student Form Component
function AddStudentForm({ 
  onSubmit, 
  classes, 
  parents 
}: { 
  onSubmit: (data: { name: string; class_id: string; parent_id: string }) => void
  classes: Class[]
  parents: Parent[]
}) {
  const [name, setName] = useState('')
  const [classId, setClassId] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ name, class_id: classId, parent_id: parentId })
    
    setName('')
    setClassId('')
    setParentId('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Student Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter student's name"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="class" className="text-sm font-medium">
          Class
        </label>
        <Select value={classId} onValueChange={setClassId}>
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
        <label htmlFor="parent" className="text-sm font-medium">
          Parent
        </label>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a parent" />
          </SelectTrigger>
          <SelectContent>
            {parents.map((parent) => (
              <SelectItem key={parent.id} value={parent.id}>
                {parent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Student...' : 'Add Student'}
      </Button>
    </form>
  )
} 