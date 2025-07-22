'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  id_number?: string
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
  email: string | null
}

export default function StudentManagement() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

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

  const handleAddStudent = async (studentData: { first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => {
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

      // First add the student - using old name field for now until schema is updated
      const studentDataToInsert: any = {
        name: `${studentData.first_name} ${studentData.last_name}`.trim(),
        class_id: studentData.class_id
      }
      

      
      // Only add id_number if it's provided and not empty
      if (studentData.id_number && studentData.id_number.trim()) {
        studentDataToInsert.id_number = studentData.id_number.trim()
      }
      
      const { data: studentResult, error: studentError } = await supabase
        .from('students')
        .insert([studentDataToInsert])
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

  const handleEditStudent = async (studentData: { id: string; first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => {
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

      // Update the student - using old name field for now until schema is updated
      const studentDataToUpdate: any = {
        name: `${studentData.first_name} ${studentData.last_name}`.trim(),
        class_id: studentData.class_id
      }
      
      // Only add id_number if it's provided and not empty
      if (studentData.id_number && studentData.id_number.trim()) {
        studentDataToUpdate.id_number = studentData.id_number.trim()
      } else {
        studentDataToUpdate.id_number = null
      }
      

      
      const { error: studentError } = await supabase
        .from('students')
        .update(studentDataToUpdate)
        .eq('id', studentData.id)

      if (studentError) {
        console.error('Error updating student:', studentError)
        toast.error('Error updating student: ' + studentError.message)
        return
      }

      // Update the student-parent relationship
      const { error: relationshipError } = await supabase
        .from('student_parent')
        .delete()
        .eq('student_id', studentData.id)

      if (relationshipError) {
        console.error('Error deleting old student-parent relationship:', relationshipError)
      }

      const { error: newRelationshipError } = await supabase
        .from('student_parent')
        .insert([{
          student_id: studentData.id,
          parent_id: studentData.parent_id
        }])

      if (newRelationshipError) {
        console.error('Error creating new student-parent relationship:', newRelationshipError)
        // Still show success since student was updated
      }

      await fetchData()
      setIsEditDialogOpen(false)
      setEditingStudent(null)
      toast.success('Student updated successfully!')
    } catch (error) {
      console.error('Error updating student:', error)
      toast.error('Error updating student')
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
          
          {/* Edit Student Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Student</DialogTitle>
                <DialogDescription>
                  Update student information and assignments
                </DialogDescription>
              </DialogHeader>
              {editingStudent && (
                <EditStudentForm 
                  student={editingStudent}
                  onSubmit={handleEditStudent} 
                  classes={classes}
                  parents={parents}
                />
              )}
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
                <TableHead>ID Number</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading students...
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
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
                      {student.id_number || 'Not assigned'}
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
                          <DropdownMenuItem onClick={() => {
                            setEditingStudent(student)
                            setIsEditDialogOpen(true)
                          }}>
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
  onSubmit: (data: { first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => void
  classes: Class[]
  parents: Parent[]
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [classId, setClassId] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [newParentPassword, setNewParentPassword] = useState('')



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    

    
    // Validate form
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter both first name and last name')
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
      
      if (!newParentPassword.trim()) {
        toast.error('Please enter a password for the parent')
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
              first_name: firstName.trim(), 
              last_name: lastName.trim(),
              middle_name: middleName.trim() || undefined,
              suffix: suffix.trim() || undefined,
              id_number: idNumber.trim() || undefined,
              class_id: classId, 
              parent_id: existingParent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setFirstName('')
            setLastName('')
            setMiddleName('')
            setSuffix('')
            setIdNumber('')
            setParentId('')
            setLoading(false)
            return
          } else {
            setNewParentEmail('')
            setLoading(false)
            return
          }
        }

        // Create new parent with auth account
        try {
          // Create parent using API endpoint
          const response = await fetch('/api/create-parent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: newParentEmail.trim(),
              password: newParentPassword.trim(),
              name: newParentName.trim()
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('API Error Response:', errorText)
            toast.error('Error creating parent account. Please check the console for details.')
            setLoading(false)
            return
          }

          const result = await response.json()

          if (result.success && result.parent) {
            // Now add the student with the new parent
            await onSubmit({ 
              first_name: firstName.trim(), 
              last_name: lastName.trim(),
              middle_name: middleName.trim() || undefined,
              suffix: suffix.trim() || undefined,
              id_number: idNumber.trim() || undefined,
              class_id: classId, 
              parent_id: result.parent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setFirstName('')
            setLastName('')
            setMiddleName('')
            setSuffix('')
            setIdNumber('')
            setParentId('')
            setLoading(false)
            return
          } else {
            console.error('API returned error:', result)
            toast.error('Error creating parent account: ' + (result.error || 'Unknown error'))
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Error creating parent:', error)
          toast.error('Error creating parent')
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
      await onSubmit({ 
        first_name: firstName.trim(), 
        last_name: lastName.trim(),
        middle_name: middleName.trim() || undefined,
        suffix: suffix.trim() || undefined,
        id_number: idNumber.trim() || undefined, 
        class_id: classId, 
        parent_id: parentId 
      })

      setFirstName('')
      setLastName('')
      setMiddleName('')
      setSuffix('')
      setIdNumber('')
      setParentId('')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="firstName" className="text-sm font-medium">
          First Name
        </label>
        <Input
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter first name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="lastName" className="text-sm font-medium">
          Last Name
        </label>
        <Input
          id="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter last name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="middleName" className="text-sm font-medium">
          Middle Name
        </label>
        <Input
          id="middleName"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
          placeholder="Enter middle name (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="suffix" className="text-sm font-medium">
          Suffix
        </label>
        <Input
          id="suffix"
          value={suffix}
          onChange={(e) => setSuffix(e.target.value)}
          placeholder="Enter suffix (e.g., Jr., Sr., III) (optional)"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="id_number" className="text-sm font-medium">
          ID Number (Optional)
        </label>
        <Input
          id="id_number"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="Enter student ID number"
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
          Parent *
        </label>
        
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
              <div>
                <Label htmlFor="parentPassword">Password *</Label>
                <Input
                  id="parentPassword"
                  type="password"
                  value={newParentPassword}
                  onChange={(e) => setNewParentPassword(e.target.value)}
                  placeholder="Enter password for parent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a password that the parent can remember easily
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Student...' : 'Add Student'}
      </Button>
    </form>
  )
}

function EditStudentForm({ 
  student, 
  onSubmit, 
  classes, 
  parents 
}: { 
  student: Student
  onSubmit: (data: { id: string; first_name: string; last_name: string; middle_name?: string; suffix?: string; id_number?: string; class_id: string; parent_id: string }) => void
  classes: Class[]
  parents: Parent[]
}) {
  // Parse the student name to get first and last name
  const nameParts = student.name.split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  
  const [editFirstName, setEditFirstName] = useState(firstName)
  const [editLastName, setEditLastName] = useState(lastName)
  const [editMiddleName, setEditMiddleName] = useState('')
  const [editSuffix, setEditSuffix] = useState('')
  const [editIdNumber, setEditIdNumber] = useState(student.id_number || '')
  const [editClassId, setEditClassId] = useState(student.class_id || '')
  const [editParentId, setEditParentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [newParentPassword, setNewParentPassword] = useState('')

  // Fetch the current parent for this student
  useEffect(() => {
    const fetchCurrentParent = async () => {
      try {
        const { data: parentData, error } = await supabase
          .from('student_parent')
          .select('parent_id')
          .eq('student_id', student.id)
          .single()

        if (!error && parentData) {
          setEditParentId(parentData.parent_id)
        }
      } catch (error) {
        console.error('Error fetching current parent:', error)
      }
    }

    if (student.id) {
      fetchCurrentParent()
    }
  }, [student.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    

    
    // Validate form
    if (!editFirstName.trim() || !editLastName.trim()) {
      toast.error('Please enter both first name and last name')
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
      
      if (!newParentPassword.trim()) {
        toast.error('Please enter a password for the parent')
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
              id: student.id,
              first_name: editFirstName.trim(), 
              last_name: editLastName.trim(),
              middle_name: editMiddleName.trim() || undefined,
              suffix: editSuffix.trim() || undefined,
              id_number: editIdNumber.trim() || undefined,
              class_id: editClassId, 
              parent_id: existingParent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setLoading(false)
            return
          } else {
            setNewParentEmail('')
            setLoading(false)
            return
          }
        }

        // Create new parent with auth account
        try {
          // Create parent using API endpoint
          const response = await fetch('/api/create-parent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: newParentEmail.trim(),
              password: newParentPassword.trim(),
              name: newParentName.trim()
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('API Error Response:', errorText)
            toast.error('Error creating parent account. Please check the console for details.')
            setLoading(false)
            return
          }

          const result = await response.json()

          if (result.success && result.parent) {
            // Now update the student with the new parent
            await onSubmit({ 
              id: student.id,
              first_name: editFirstName.trim(), 
              last_name: editLastName.trim(),
              middle_name: editMiddleName.trim() || undefined,
              suffix: editSuffix.trim() || undefined,
              id_number: editIdNumber.trim() || undefined,
              class_id: editClassId, 
              parent_id: result.parent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setLoading(false)
            return
          } else {
            console.error('API returned error:', result)
            toast.error('Error creating parent account: ' + (result.error || 'Unknown error'))
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Error creating parent:', error)
          toast.error('Error creating parent')
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
      if (!editParentId) {
        toast.error('Please select a parent for the student')
        return
      }
      
      setLoading(true)
      await onSubmit({ 
        id: student.id,
        first_name: editFirstName.trim(), 
        last_name: editLastName.trim(),
        middle_name: editMiddleName.trim() || undefined,
        suffix: editSuffix.trim() || undefined,
        id_number: editIdNumber.trim() || undefined, 
        class_id: editClassId, 
        parent_id: editParentId 
      })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="editFirstName" className="text-sm font-medium">
          First Name
        </label>
        <Input
          id="editFirstName"
          value={editFirstName}
          onChange={(e) => setEditFirstName(e.target.value)}
          placeholder="Enter first name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editLastName" className="text-sm font-medium">
          Last Name
        </label>
        <Input
          id="editLastName"
          value={editLastName}
          onChange={(e) => setEditLastName(e.target.value)}
          placeholder="Enter last name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editMiddleName" className="text-sm font-medium">
          Middle Name
        </label>
        <Input
          id="editMiddleName"
          value={editMiddleName}
          onChange={(e) => setEditMiddleName(e.target.value)}
          placeholder="Enter middle name (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editSuffix" className="text-sm font-medium">
          Suffix
        </label>
        <Input
          id="editSuffix"
          value={editSuffix}
          onChange={(e) => setEditSuffix(e.target.value)}
          placeholder="Enter suffix (e.g., Jr., Sr., III) (optional)"
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editIdNumber" className="text-sm font-medium">
          ID Number (Optional)
        </label>
        <Input
          id="editIdNumber"
          value={editIdNumber}
          onChange={(e) => setEditIdNumber(e.target.value)}
          placeholder="Enter student ID number"
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editClass" className="text-sm font-medium">
          Class
        </label>
        <Select value={editClassId} onValueChange={setEditClassId}>
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
        <label htmlFor="editParent" className="text-sm font-medium">
          Parent *
        </label>
        
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
                <Label htmlFor="editParentName">Parent Name *</Label>
                <Input
                  id="editParentName"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  placeholder="Enter parent name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editParentEmail">Email *</Label>
                <Input
                  id="editParentEmail"
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
              <div>
                <Label htmlFor="editParentPassword">Password *</Label>
                <Input
                  id="editParentPassword"
                  type="password"
                  value={newParentPassword}
                  onChange={(e) => setNewParentPassword(e.target.value)}
                  placeholder="Enter password for parent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a password that the parent can remember easily
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
                <Select value={editParentId} onValueChange={setEditParentId} required>
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
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating...' : 'Update Student'}
      </Button>
    </form>
  )
} 