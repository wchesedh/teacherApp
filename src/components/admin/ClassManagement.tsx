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
import { toast } from 'sonner'

interface Class {
  id: string
  name: string
  teacher_id: string | null
  created_at?: string
}

interface Teacher {
  id: string
  name: string
  email: string
}

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    testDatabaseConnection()
    fetchData()
  }, [])

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection for classes...')
      
      // Check current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Current session:', session)
      console.log('Session error:', sessionError)
      
      if (!session) {
        console.error('No active session found')
        return
      }
      
      console.log('User ID:', session.user.id)
      console.log('User email:', session.user.email)
      console.log('User metadata:', session.user.user_metadata)
      
      // Test if we can access the classes table and see its structure
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .limit(1)
      
      console.log('Database connection test result:', { data, error })
      
      if (data && data.length > 0) {
        console.log('Classes table structure (sample row):', data[0])
        console.log('Available columns:', Object.keys(data[0]))
      }
      
      if (error) {
        console.error('Database connection failed:', error)
        console.error('This might mean:')
        console.error('1. The classes table does not exist')
        console.error('2. RLS policies are blocking access')
        console.error('3. The user does not have permission')
      } else {
        console.log('Database connection successful')
      }
    } catch (error) {
      console.error('Exception during database connection test:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      console.log('Fetching classes and teachers from database...')
      
      // Check current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Current session:', session)
      console.log('Session error:', sessionError)
      
      if (!session) {
        console.error('No active session found')
        toast.error('No active session found')
        return
      }
      
      console.log('User ID:', session.user.id)
      console.log('User email:', session.user.email)
      console.log('User metadata:', session.user.user_metadata)
      
      // Fetch classes with teacher info
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          teachers:teacher_id(name, email)
        `)
      
      console.log('Classes response:', { data: classesData, error: classesError })
      
      // Fetch teachers for dropdown
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
      
      console.log('Teachers response:', { data: teachersData, error: teachersError })
      
      if (classesError) {
        console.error('Error fetching classes:', classesError)
        console.error('Error details:', {
          message: classesError.message,
          details: classesError.details,
          hint: classesError.hint,
          code: classesError.code
        })
        toast.error(`Error fetching classes: ${classesError.message}`)
      } else {
        console.log('Classes fetched successfully:', classesData)
        setClasses(classesData || [])
      }
      
      if (teachersError) {
        console.error('Error fetching teachers:', teachersError)
        console.error('Error details:', {
          message: teachersError.message,
          details: teachersError.details,
          hint: teachersError.hint,
          code: teachersError.code
        })
      } else {
        console.log('Teachers fetched successfully:', teachersData)
        setTeachers(teachersData || [])
      }
      
    } catch (error) {
      console.error('Exception fetching data:', error)
      console.error('Error type:', typeof error)
      console.error('Error object:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error fetching data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredClasses = classes.filter(classItem =>
    classItem.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddClass = async (classData: { name: string; teacher_id: string }) => {
    try {
      const { error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          teacher_id: classData.teacher_id
        }])

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      await fetchData()
      setIsAddDialogOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) {
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
        await fetchData()
        toast.success('Class deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting class:', error)
      toast.error('Error deleting class')
    }
  }

  const getTeacherName = (teacherId: string | null) => {
    if (!teacherId) return 'Not assigned'
    const teacher = teachers.find(t => t.id === teacherId)
    return teacher ? teacher.name : 'Unknown teacher'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Class Management</CardTitle>
            <CardDescription>
              Manage all classes in the system ({classes.length} classes)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>
                  Create a new class and assign a teacher
                </DialogDescription>
              </DialogHeader>
              <AddClassForm 
                onSubmit={handleAddClass} 
                teachers={teachers}
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
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Classes Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading classes...
                  </TableCell>
                </TableRow>
              ) : filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No classes found. Add your first class using the "Add Class" button above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((classItem) => (
                  <TableRow key={classItem.id}>
                    <TableCell className="font-medium">
                      {classItem.name}
                    </TableCell>
                    <TableCell>
                      {getTeacherName(classItem.teacher_id)}
                    </TableCell>
                    <TableCell>
                      {classItem.created_at ? new Date(classItem.created_at).toLocaleDateString() : 'N/A'}
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
                            View Students
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Class
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteClass(classItem.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Class
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

// Add Class Form Component
function AddClassForm({ 
  onSubmit, 
  teachers 
}: { 
  onSubmit: (data: { name: string; teacher_id: string }) => void
  teachers: Teacher[]
}) {
  const [name, setName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ name, teacher_id: teacherId })
    
    setName('')
    setTeacherId('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Class Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter class name"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="teacher" className="text-sm font-medium">
          Teacher
        </label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Class...' : 'Add Class'}
      </Button>
    </form>
  )
} 