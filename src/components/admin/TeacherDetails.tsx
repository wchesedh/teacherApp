'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  User, 
  BookOpen, 
  GraduationCap, 
  Users, 
  Mail, 
  Calendar,
  Plus,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
}

interface Student {
  id: string
  name: string
  class_id: string | null
  created_at?: string
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at?: string
}

interface StudentParent {
  student_id: string
  parent_id: string
}

export default function TeacherDetails({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [parents, setParents] = useState<Parent[]>([])
  const [studentParents, setStudentParents] = useState<StudentParent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClasses, setExpandedClasses] = useState<string[]>([])
  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<string>('')

  useEffect(() => {
    if (teacherId) {
      fetchTeacherDetails()
    }
  }, [teacherId])

  const fetchTeacherDetails = async () => {
    try {
      setLoading(true)
      console.log('Fetching teacher details for:', teacherId)

      // Fetch teacher info
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single()

      if (teacherError) {
        console.error('Error fetching teacher:', teacherError)
        toast.error('Error fetching teacher details')
        return
      }

      setTeacher(teacherData)

      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId)

      if (classesError) {
        console.error('Error fetching classes:', classesError)
      } else {
        setClasses(classesData || [])
      }

      // Fetch all students (we'll filter by class later)
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
      } else {
        setStudents(studentsData || [])
      }

      // Fetch all parents
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')

      if (parentsError) {
        console.error('Error fetching parents:', parentsError)
      } else {
        setParents(parentsData || [])
      }

      // Fetch student-parent relationships
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('*')

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
      } else {
        setStudentParents(studentParentsData || [])
      }

    } catch (error) {
      console.error('Error fetching teacher details:', error)
      toast.error('Error fetching teacher details')
    } finally {
      setLoading(false)
    }
  }

  const getStudentsInClass = (classId: string) => {
    return students.filter(student => student.class_id === classId)
  }

  const getParentsForStudent = (studentId: string) => {
    const parentIds = studentParents
      .filter(sp => sp.student_id === studentId)
      .map(sp => sp.parent_id)
    
    return parents.filter(parent => parentIds.includes(parent.id))
  }

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
          teacher_id: teacherId
        }])

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      await fetchTeacherDetails()
      setIsAddClassOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? This will also remove all students from this class.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)

      if (error) {
        console.error('Error deleting class:', error)
        toast.error('Error deleting class: ' + error.message)
      } else {
        await fetchTeacherDetails()
        toast.success('Class deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting class:', error)
      toast.error('Error deleting class')
    }
  }

  const handleAddStudent = async (studentData: { name: string; class_id: string; parent_id: string }) => {
    try {
      // Validate that a parent is selected
      if (!studentData.parent_id) {
        toast.error('Please select a parent for the student')
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
          console.error('Relationship error details:', {
            message: relationshipError.message,
            details: relationshipError.details,
            hint: relationshipError.hint,
            code: relationshipError.code
          })
          toast.error('Error creating student-parent relationship: ' + relationshipError.message)
          return
        }
      }

      await fetchTeacherDetails()
      setIsAddStudentOpen(false)
      toast.success('Student created successfully!')
    } catch (error) {
      console.error('Error adding student:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error('Error creating student: ' + errorMessage)
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

      if (error) {
        console.error('Error deleting student:', error)
        toast.error('Error deleting student: ' + error.message)
      } else {
        await fetchTeacherDetails()
        toast.success('Student deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting student:', error)
      toast.error('Error deleting student')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading teacher details...</p>
        </div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Teacher not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Teacher Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{teacher.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>{teacher.email}</span>
                {teacher.created_at && (
                  <>
                    <span>•</span>
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(teacher.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Classes and Students */}
      <div className="space-y-6">
        {/* Header with Add Class Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Classes & Students</h2>
            <p className="text-gray-600">Manage classes and their students</p>
          </div>
          <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Class</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>
                  Create a new class for this teacher
                </DialogDescription>
              </DialogHeader>
              <AddClassForm onSubmit={handleAddClass} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Classes List */}
        {classes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Yet</h3>
              <p className="text-gray-600 mb-4">This teacher doesn't have any classes assigned yet.</p>
              <Button onClick={() => setIsAddClassOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {classes.map((classItem) => (
              <Card key={classItem.id}>
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={(e) => {
                    // Don't expand if clicking on buttons
                    if ((e.target as HTMLElement).closest('button')) {
                      return
                    }
                    toggleClassExpansion(classItem.id)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8">
                        {expandedClasses.includes(classItem.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <CardDescription className="flex items-center space-x-2">
                          <Badge variant="secondary">
                            {getStudentsInClass(classItem.id).length} students
                          </Badge>
                          {classItem.created_at && (
                            <span>Created {new Date(classItem.created_at).toLocaleDateString()}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Student
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Student to {classItem.name}</DialogTitle>
                            <DialogDescription>
                              Add a new student to this class
                            </DialogDescription>
                          </DialogHeader>
                                                     <AddStudentForm 
                             onSubmit={handleAddStudent} 
                             classId={classItem.id}
                             parents={parents}
                             onParentAdded={fetchTeacherDetails}
                           />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClass(classItem.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedClasses.includes(classItem.id) && (
                  <CardContent>
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Students in this class:</h4>
                      {getStudentsInClass(classItem.id).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                          <GraduationCap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600">No students in this class yet.</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => setIsAddStudentOpen(true)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Student
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {getStudentsInClass(classItem.id).map((student) => (
                            <div key={student.id} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <GraduationCap className="w-5 h-5 text-gray-600" />
                                  <span className="font-medium">{student.name}</span>
                                  {student.created_at && (
                                    <Badge variant="outline" className="text-xs">
                                      Joined {new Date(student.created_at).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/admin/students/${student.id}`)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Parents for this student */}
                              <div className="ml-8">
                                <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                                  <Users className="w-4 h-4" />
                                  <span>Parents:</span>
                                </h5>
                                {getParentsForStudent(student.id).length === 0 ? (
                                  <p className="text-gray-500 text-sm">No parents assigned to this student.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {getParentsForStudent(student.id).map((parent) => (
                                      <div key={parent.id} className="flex items-center space-x-3 text-sm">
                                        <User className="w-4 h-4 text-gray-500" />
                                        <span className="font-medium">{parent.name}</span>
                                        {parent.email && (
                                          <>
                                            <span className="text-gray-400">•</span>
                                            <span className="text-gray-600">{parent.email}</span>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Add Class Form Component
function AddClassForm({ onSubmit }: { onSubmit: (data: { name: string }) => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ name })
    
    setName('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Class Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter class name"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating Class...' : 'Create Class'}
      </Button>
    </form>
  )
}

// Add Student Form Component
function AddStudentForm({ 
  onSubmit, 
  classId,
  parents,
  onParentAdded
}: { 
  onSubmit: (data: { name: string; class_id: string; parent_id: string }) => void
  classId: string
  parents: Parent[]
  onParentAdded?: () => void
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [addingParent, setAddingParent] = useState(false)

  const handleAddParent = async () => {
    if (!newParentName.trim()) {
      toast.error('Please enter a parent name')
      return
    }

    if (!newParentEmail.trim()) {
      toast.error('Please enter a parent email')
      return
    }

    // Check if parent with this email already exists
    const { data: existingParent, error: checkError } = await supabase
      .from('parents')
      .select('*')
      .eq('email', newParentEmail.trim())
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking existing parent:', checkError)
      toast.error('Error checking existing parent')
      return
    }

    if (existingParent) {
      // Parent with this email already exists
      const useExisting = confirm(
        `A parent with email "${newParentEmail.trim()}" already exists:\n\n` +
        `Name: ${existingParent.name}\n` +
        `Email: ${existingParent.email}\n\n` +
        `Would you like to use this existing parent instead?`
      )
      
      if (useExisting) {
        setParentId(existingParent.id)
        setShowAddParent(false)
        setNewParentName('')
        setNewParentEmail('')
        toast.success('Using existing parent')
        return
      } else {
        // User chose not to use existing parent, clear email and let them try again
        setNewParentEmail('')
        return
      }
    }

    setAddingParent(true)
    try {
      const { data: parentResult, error } = await supabase
        .from('parents')
        .insert([{
          name: newParentName.trim(),
          email: newParentEmail.trim()
        }])
        .select()

      if (error) {
        console.error('Error adding parent:', error)
        toast.error('Error creating parent: ' + error.message)
        return
      }

      if (parentResult && parentResult[0]) {
        setParentId(parentResult[0].id)
        setShowAddParent(false)
        setNewParentName('')
        setNewParentEmail('')
        toast.success('Parent created successfully!')
        // Refresh the parent list
        if (onParentAdded) {
          onParentAdded()
        }
      }
    } catch (error) {
      console.error('Error adding parent:', error)
      toast.error('Error creating parent')
    } finally {
      setAddingParent(false)
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

        // Create new parent
        const { data: parentResult, error } = await supabase
          .from('parents')
          .insert([{
            name: newParentName.trim(),
            email: newParentEmail.trim()
          }])
          .select()

        if (error) {
          console.error('Error adding parent:', error)
          toast.error('Error creating parent: ' + error.message)
          setLoading(false)
          return
        }

        if (parentResult && parentResult[0]) {
          // Now add the student with the new parent
          await onSubmit({ 
            name: name.trim(), 
            class_id: classId, 
            parent_id: parentResult[0].id 
          })
          setShowAddParent(false)
          setNewParentName('')
          setNewParentEmail('')
          setName('')
          setParentId('')
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
                      <User className="w-4 h-4 text-blue-600" />
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
        disabled={loading || (!parentId && !showAddParent) || (showAddParent && (!newParentName.trim() || !newParentEmail.trim()))}
      >
        {loading ? 'Adding Student...' : 'Add Student'}
      </Button>
    </form>
  )
} 