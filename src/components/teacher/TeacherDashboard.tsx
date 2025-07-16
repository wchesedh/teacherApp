'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Users, BookOpen, GraduationCap, MessageSquare, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Layout from '../Layout'
import { toast } from 'sonner'
import Link from 'next/link'

// Generate a random password for parent accounts
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let password = ''
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

interface Stats {
  classes: number
  parents: number
  students: number
  posts: number
}

interface Class {
  id: string
  name: string
  created_at: string
  students?: Student[]
}

interface Student {
  id: string
  name: string
  class_id: string
  created_at: string
  parents?: Parent[]
}

interface Parent {
  id: string
  name: string
  email: string | null
  created_at: string
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    classes: 0,
    parents: 0,
    students: 0,
    posts: 0
  })
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClasses, setExpandedClasses] = useState<string[]>([])
  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  const [selectedClassForStudent, setSelectedClassForStudent] = useState<string>('')
  const [showCredentials, setShowCredentials] = useState(false)
  const [parentCredentials, setParentCredentials] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch classes count for this teacher
      const { count: classesCount, error: classesError } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user?.id)

      // Fetch students count for this teacher's classes
      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', 
          (await supabase
            .from('classes')
            .select('id')
            .eq('teacher_id', user?.id)
          ).data?.map(c => c.id) || []
        )

      // Fetch parents count for students in this teacher's classes
      const { data: studentParentsData, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('parent_id')
        .in('student_id',
          (await supabase
            .from('students')
            .select('id')
            .in('class_id',
              (await supabase
                .from('classes')
                .select('id')
                .eq('teacher_id', user?.id)
              ).data?.map(c => c.id) || []
            )
          ).data?.map(s => s.id) || []
        )

      // Get unique parent count
      const uniqueParentIds = new Set(studentParentsData?.map(sp => sp.parent_id) || [])
      const parentsCount = uniqueParentIds.size

      // Fetch posts count for this teacher
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user?.id)

      setStats({
        classes: classesCount || 0,
        parents: parentsCount,
        students: studentsCount || 0,
        posts: postsCount || 0
      })

      // Fetch classes with students and parents
      await fetchClassesWithDetails()

      // Log any errors for debugging
      if (classesError) console.error('Error fetching classes:', classesError)
      if (studentsError) console.error('Error fetching students:', studentsError)
      if (studentParentsError) console.error('Error fetching student-parent relationships:', studentParentsError)
      if (postsError) console.error('Error fetching posts:', postsError)

    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClassesWithDetails = async () => {
    try {
      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false })

      if (classesError) {
        console.error('Error fetching classes:', classesError)
        return
      }

      const classesWithDetails = await Promise.all(
        (classesData || []).map(async (classItem) => {
          // Fetch students for this class
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', classItem.id)
            .order('created_at', { ascending: false })

          if (studentsError) {
            console.error('Error fetching students for class:', classItem.id, studentsError)
            return { ...classItem, students: [] }
          }

          // Fetch parents for each student
          const studentsWithParents = await Promise.all(
            (studentsData || []).map(async (student) => {
              const { data: studentParentsData, error: studentParentsError } = await supabase
                .from('student_parent')
                .select('parent_id')
                .eq('student_id', student.id)

              if (studentParentsError) {
                console.error('Error fetching parents for student:', student.id, studentParentsError)
                return { ...student, parents: [] }
              }

              const parentIds = studentParentsData?.map(sp => sp.parent_id) || []
              
              if (parentIds.length === 0) {
                return { ...student, parents: [] }
              }

              const { data: parentsData, error: parentsError } = await supabase
                .from('parents')
                .select('*')
                .in('id', parentIds)

              if (parentsError) {
                console.error('Error fetching parents:', parentsError)
                return { ...student, parents: [] }
              }

              return { ...student, parents: parentsData || [] }
            })
          )

          return { ...classItem, students: studentsWithParents }
        })
      )

      setClasses(classesWithDetails)
    } catch (error) {
      console.error('Error fetching classes with details:', error)
    }
  }

  const statsData = [
    {
      title: 'My Classes',
      value: stats.classes.toString(),
      icon: BookOpen,
      description: 'Classes you teach'
    },
    {
      title: 'My Students\' Parents',
      value: stats.parents.toString(),
      icon: Users,
      description: 'Parents of your students'
    },
    {
      title: 'My Students',
      value: stats.students.toString(),
      icon: GraduationCap,
      description: 'Students in your classes'
    },
    {
      title: 'My Posts',
      value: stats.posts.toString(),
      icon: MessageSquare,
      description: 'Posts you\'ve created'
    }
  ]

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
          teacher_id: user?.id
        }])

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      await fetchData()
      setIsAddClassOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

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
      setIsAddStudentOpen(false)
      toast.success('Student created successfully!')
    } catch (error) {
      console.error('Error adding student:', error)
      toast.error('Error creating student')
    }
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Teacher Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your classes, students, and communicate with parents
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {statsData.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Classes Management */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>My Classes</CardTitle>
                <CardDescription>
                  Manage your classes and their students ({classes.length} classes)
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddClassOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No classes yet. Create your first class to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {classes.map((classItem) => (
                  <div key={classItem.id} className="border rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleClassExpansion(classItem.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {expandedClasses.includes(classItem.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <div>
                          <h3 className="font-medium">{classItem.name}</h3>
                          <p className="text-sm text-gray-500">
                            {classItem.students?.length || 0} students
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedClassForStudent(classItem.id)
                          setIsAddStudentOpen(true)
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add Student
                      </Button>
                    </div>
                    
                    {expandedClasses.includes(classItem.id) && (
                      <div className="border-t bg-gray-50 p-4">
                        {classItem.students && classItem.students.length > 0 ? (
                          <div className="space-y-3">
                                                         {classItem.students.map((student) => (
                               <div key={student.id} className="bg-white p-3 rounded border">
                                 <div className="flex items-center justify-between">
                                   <div>
                                     <h4 className="font-medium">{student.name}</h4>
                                     {student.parents && student.parents.length > 0 ? (
                                       <div className="text-sm text-gray-500 mt-1">
                                         Parents: {student.parents.map(p => p.name).join(', ')}
                                       </div>
                                     ) : (
                                       <div className="text-sm text-gray-400 mt-1">No parents assigned</div>
                                     )}
                                   </div>
                                   <Link href={`/teacher/students/${student.id}`}>
                                     <Button
                                       size="sm"
                                       variant="outline"
                                     >
                                       <Eye className="w-4 h-4 mr-1" />
                                       View Details
                                     </Button>
                                   </Link>
                                 </div>
                               </div>
                             ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            No students in this class yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Class Dialog */}
        <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Create a new class for your students
              </DialogDescription>
            </DialogHeader>
            <AddClassForm onSubmit={handleAddClass} />
          </DialogContent>
        </Dialog>

        {/* Add Student Dialog */}
        <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Add a new student to a class and assign them to a parent
              </DialogDescription>
            </DialogHeader>
            <AddStudentForm 
              onSubmit={handleAddStudent}
              selectedClassId={selectedClassForStudent}
              classes={classes}
              onParentCreated={(credentials) => {
                setParentCredentials(credentials)
                setShowCredentials(true)
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Parent Credentials Dialog */}
        <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Parent Account Created</DialogTitle>
              <DialogDescription>
                The parent account has been created successfully. Please share these login credentials with the parent.
              </DialogDescription>
            </DialogHeader>
            {parentCredentials && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Login Credentials</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Email:</span> {parentCredentials.email}
                    </div>
                    <div>
                      <span className="font-medium">Password:</span> {parentCredentials.password}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  The parent can now log in at the app and view their child's progress updates.
                </p>
                <Button 
                  onClick={() => setShowCredentials(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
}



// Add Class Form Component
function AddClassForm({ onSubmit }: { onSubmit: (data: { name: string }) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    onSubmit({ name: name.trim() })
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="className">Class Name</Label>
        <Input
          id="className"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter class name"
          required
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="submit">
          Create Class
        </Button>
      </div>
    </form>
  )
}

// Add Student Form Component
function AddStudentForm({ 
  onSubmit, 
  selectedClassId,
  classes,
  onParentCreated
}: { 
  onSubmit: (data: { name: string; class_id: string; parent_id: string }) => void
  selectedClassId: string
  classes: Class[]
  onParentCreated?: (credentials: { email: string; password: string }) => void
}) {
  const [name, setName] = useState('')
  const [classId, setClassId] = useState(selectedClassId)
  const [parentId, setParentId] = useState('')
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newParentEmail, setNewParentEmail] = useState('')
  const [newParentPassword, setNewParentPassword] = useState('')

  useEffect(() => {
    fetchParents()
  }, [])

  const fetchParents = async () => {
    try {
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .order('name')
      
      if (error) {
        console.error('Error fetching parents:', error)
      } else {
        setParents(data || [])
      }
    } catch (error) {
      console.error('Error fetching parents:', error)
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
              name: name.trim(), 
              class_id: classId, 
              parent_id: existingParent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
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

        // Create new parent with auth account
        try {
          // Validate password
          if (!newParentPassword.trim()) {
            toast.error('Please enter a password for the parent')
            return
          }
          
          // Create parent using API endpoint (doesn't log in the user)
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
              name: name.trim(), 
              class_id: classId, 
              parent_id: result.parent.id 
            })
            setShowAddParent(false)
            setNewParentName('')
            setNewParentEmail('')
            setNewParentPassword('')
            setName('')
            setParentId('')
            setLoading(false)
            
            // Show credentials dialog
            if (onParentCreated) {
              onParentCreated({
                email: newParentEmail.trim(),
                password: newParentPassword.trim()
              })
            }
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
        <Label htmlFor="classSelect">Class *</Label>
        <Select value={classId} onValueChange={setClassId} required>
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
                
                {/* Selected Parent Details */}
                {selectedParent && (
                  <div className="p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600" />
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
        disabled={loading || (!parentId && !showAddParent) || (showAddParent && (!newParentName.trim() || !newParentEmail.trim() || !newParentPassword.trim()))}
      >
        {loading ? 'Adding Student...' : 'Add Student'}
      </Button>
    </form>
  )
}

 