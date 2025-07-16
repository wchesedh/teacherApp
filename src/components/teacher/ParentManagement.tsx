'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface Parent {
  id: string
  name: string
  email: string | null
  created_at: string
}

export default function ParentManagement() {
  const { user } = useAuth()
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    fetchParents()
  }, [])

  const fetchParents = async () => {
    try {
      setLoading(true)
      
      // First get the teacher's classes
      const { data: teacherClasses, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user?.id)

      if (classesError) {
        console.error('Error fetching teacher classes:', classesError)
        toast.error('Error fetching classes')
        return
      }

      const classIds = teacherClasses?.map(c => c.id) || []

      if (classIds.length === 0) {
        setParents([])
        setLoading(false)
        return
      }

      // Get students in teacher's classes
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .in('class_id', classIds)

      if (studentsError) {
        console.error('Error fetching students:', studentsError)
        toast.error('Error fetching students')
        return
      }

      const studentIds = students?.map(s => s.id) || []

      if (studentIds.length === 0) {
        setParents([])
        setLoading(false)
        return
      }

      // Get parent IDs for these students
      const { data: studentParents, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('parent_id')
        .in('student_id', studentIds)

      if (studentParentsError) {
        console.error('Error fetching student-parent relationships:', studentParentsError)
        toast.error('Error fetching parent relationships')
        return
      }

      const parentIds = [...new Set(studentParents?.map(sp => sp.parent_id) || [])]

      if (parentIds.length === 0) {
        setParents([])
        setLoading(false)
        return
      }

      // Get parent details
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')
        .in('id', parentIds)
        .order('created_at', { ascending: false })
      
      if (parentsError) {
        console.error('Error fetching parents:', parentsError)
        toast.error('Error fetching parents')
      } else {
        setParents(parentsData || [])
      }
    } catch (error) {
      console.error('Error fetching parents:', error)
      toast.error('Error fetching parents')
    } finally {
      setLoading(false)
    }
  }

  const filteredParents = parents.filter(parent =>
    parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (parent.email && parent.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleAddParent = async (parentData: { name: string; email: string }) => {
    try {
      const { error } = await supabase
        .from('parents')
        .insert([{
          name: parentData.name,
          email: parentData.email
        }])

      if (error) {
        console.error('Error adding parent:', error)
        toast.error('Error creating parent: ' + error.message)
        return
      }

      await fetchParents()
      setIsAddDialogOpen(false)
      toast.success('Parent created successfully!')
    } catch (error) {
      console.error('Error adding parent:', error)
      toast.error('Error creating parent')
    }
  }

  const handleDeleteParent = async (parentId: string) => {
    if (!confirm('Are you sure you want to delete this parent?')) {
      return
    }

    try {
      // Verify this parent has students in the teacher's classes
      const { data: studentParents, error: studentParentsError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', parentId)
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

      if (studentParentsError) {
        console.error('Error verifying parent relationship:', studentParentsError)
        toast.error('Error verifying parent relationship')
        return
      }

      if (!studentParents || studentParents.length === 0) {
        toast.error('You can only delete parents of your students')
        return
      }

      const { error } = await supabase
        .from('parents')
        .delete()
        .eq('id', parentId)

      if (error) {
        console.error('Error deleting parent:', error)
        toast.error('Error deleting parent: ' + error.message)
      } else {
        await fetchParents()
        toast.success('Parent deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting parent:', error)
      toast.error('Error deleting parent')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>My Students' Parents</CardTitle>
            <CardDescription>
              Parents of students in your classes ({parents.length} parents)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Parent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Parent</DialogTitle>
                <DialogDescription>
                  Add a new parent to the system
                </DialogDescription>
              </DialogHeader>
              <AddParentForm onSubmit={handleAddParent} />
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
              placeholder="Search parents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Parents Table */}
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
                    Loading parents...
                  </TableCell>
                </TableRow>
              ) : filteredParents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No parents found. Add your first parent using the "Add Parent" button above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParents.map((parent) => (
                  <TableRow key={parent.id}>
                    <TableCell className="font-medium">
                      {parent.name}
                    </TableCell>
                    <TableCell>
                      {parent.email || 'No email'}
                    </TableCell>
                    <TableCell>
                      {new Date(parent.created_at).toLocaleDateString()}
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
                            View Children
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Parent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteParent(parent.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Parent
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

// Add Parent Form Component
function AddParentForm({ onSubmit }: { onSubmit: (data: { name: string; email: string }) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ name, email })
    
    setName('')
    setEmail('')
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
          placeholder="Enter parent's full name"
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
          placeholder="Enter parent's email"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Parent...' : 'Add Parent'}
      </Button>
    </form>
  )
} 