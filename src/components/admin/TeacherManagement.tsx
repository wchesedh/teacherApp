'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Teacher {
  id: string
  name: string
  email: string
  created_at: string
}

export default function TeacherManagement() {
  const router = useRouter()
  const { user } = useAuth()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  useEffect(() => {
    // Only test connection and fetch data if we have a user
    if (user) {
      testDatabaseConnection()
      fetchTeachers()
    }
  }, [user])

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection...')
      
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
      
      // Test if we can access the teachers table and see its structure
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .limit(1)
      
      console.log('Database connection test result:', { data, error })
      
      if (data && data.length > 0) {
        console.log('Teachers table structure (sample row):', data[0])
        console.log('Available columns:', Object.keys(data[0]))
      }
      
      if (error) {
        console.error('Database connection failed:', error)
        console.error('This might mean:')
        console.error('1. The teachers table does not exist')
        console.error('2. RLS policies are blocking access')
        console.error('3. The user does not have permission')
      } else {
        console.log('Database connection successful')
      }
    } catch (error) {
      console.error('Exception during database connection test:', error)
    }
  }

  const fetchTeachers = async () => {
    try {
      setLoading(true)
      console.log('Fetching teachers from database...')
      
      // Query the teachers table
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false })
      
      console.log('Supabase response:', { data, error })
      
      if (error) {
        console.error('Error fetching teachers:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        setDbError(error.message || 'Failed to fetch teachers')
        setTeachers([])
      } else {
        console.log('Teachers fetched successfully:', data)
        setDbError(null)
        setTeachers(data || [])
      }
    } catch (error) {
      console.error('Exception fetching teachers:', error)
      console.error('Error type:', typeof error)
      console.error('Error object:', error)
      setDbError('Network error occurred while fetching teachers')
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddTeacher = async (teacherData: { name: string; email: string; password: string }) => {
    try {
      // First, create the authentication account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: teacherData.email,
        password: teacherData.password,
        options: {
          data: {
            name: teacherData.name,
            role: 'teacher'
          }
        }
      })

      if (authError) {
        console.error('Error creating auth account:', authError)
        toast.error('Error creating teacher account: ' + authError.message)
        return
      }

      if (!authData.user) {
        toast.error('Error creating teacher account: No user data returned')
        return
      }

      // Then, add to teachers table with the auth user ID
      const { error: dbError } = await supabase
        .from('teachers')
        .insert([{
          id: authData.user.id, // Use the auth user ID
          name: teacherData.name,
          email: teacherData.email
          // Don't store password in database - it's handled by auth
        }])

      if (dbError) {
        console.error('Error adding to teachers table:', dbError)
        // If database insert fails, we should clean up the auth account
        // For now, just show the error
        toast.error('Error creating teacher record: ' + dbError.message)
        return
      }

      await fetchTeachers()
      setIsAddDialogOpen(false)
      toast.success('Teacher created successfully! The teacher can now log in with their email and password.')
    } catch (error) {
      console.error('Error adding teacher:', error)
      toast.error('Error creating teacher')
    }
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId)

      if (error) {
        console.error('Error deleting teacher:', error)
        toast.error('Error deleting teacher: ' + error.message)
      } else {
        await fetchTeachers()
        toast.success('Teacher deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting teacher:', error)
      toast.error('Error deleting teacher')
    }
  }

  const handleViewTeacherDetails = (teacherId: string) => {
    router.push(`/admin/teachers/${teacherId}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Teacher Management</CardTitle>
            <CardDescription>
              Manage all teachers in the system ({teachers.length} teachers)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>
                  Create a new teacher account
                </DialogDescription>
              </DialogHeader>
              <AddTeacherForm onSubmit={handleAddTeacher} />
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
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Teachers Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading teachers...
                  </TableCell>
                </TableRow>
              ) : dbError ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-red-600">
                      <p className="font-medium">Database Error</p>
                      <p className="text-sm">{dbError}</p>
                      <p className="text-xs mt-2">Check the browser console for more details.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No teachers found. Add your first teacher using the "Add Teacher" button above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">
                      {teacher.name}
                    </TableCell>
                    <TableCell>{teacher.email}</TableCell>
                    <TableCell>
                      {new Date(teacher.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewTeacherDetails(teacher.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Teacher
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteTeacher(teacher.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Teacher
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

// Add Teacher Form Component
function AddTeacherForm({ onSubmit }: { onSubmit: (data: { name: string; email: string; password: string }) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ name, email, password })
    
    setName('')
    setEmail('')
    setPassword('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Full Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter teacher's full name"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter teacher's email"
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Teacher...' : 'Add Teacher'}
      </Button>
    </form>
  )
} 