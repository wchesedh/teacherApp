'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Mail, 
  Calendar, 
  Eye, 
  EyeOff,
  Copy,
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingParent, setEditingParent] = useState<Parent | null>(null)

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

      // Get unique parent IDs from students
      const uniqueParentIds = [...new Set(studentParentsData?.map(sp => sp.parent_id) || [])]

      // Also fetch all parents (including those without students yet)
      // This allows teachers to see parents they've created even if they haven't been linked to students
      const { data: allParentsData, error: allParentsError } = await supabase
        .from('parents')
        .select('*')
        .order('created_at', { ascending: false })

      if (allParentsError) {
        console.error('Error fetching all parents:', allParentsError)
        toast.error('Error loading parents')
        return
      }

      // Combine parents from students and all parents, removing duplicates
      const allParentIds = new Set([
        ...uniqueParentIds,
        ...(allParentsData?.map(p => p.id) || [])
      ])

      // Fetch parent details for all parents
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')
        .in('id', Array.from(allParentIds))
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

  const handleEditParent = async (parentData: { id: string; name: string; email: string; password?: string }) => {
    try {
      // Check if parent with this email already exists (excluding current parent)
      const { data: existingParent, error: checkError } = await supabase
        .from('parents')
        .select('*')
        .eq('email', parentData.email.trim())
        .neq('id', parentData.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing parent:', checkError)
        toast.error('Error checking existing parent')
        return
      }

      if (existingParent) {
        toast.error('A parent with this email already exists')
        return
      }

      // Update parent data
      const updateData: any = {
        name: parentData.name.trim(),
        email: parentData.email.trim()
      }

      // Only update password if provided
      if (parentData.password && parentData.password.trim()) {
        updateData.password = parentData.password.trim()
      }

      const { error } = await supabase
        .from('parents')
        .update(updateData)
        .eq('id', parentData.id)

      if (error) {
        console.error('Error updating parent:', error)
        toast.error('Error updating parent')
        return
      }

      setIsEditDialogOpen(false)
      setEditingParent(null)
      await fetchParents() // Refresh the parents list
      toast.success('Parent updated successfully!')
    } catch (error) {
      console.error('Error updating parent:', error)
      toast.error('Error updating parent')
    }
  }

  const handleDeleteParent = async (parentId: string) => {
    try {
      // Check if parent has any students linked
      const { data: studentRelationships, error: checkError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('parent_id', parentId)

      if (checkError) {
        console.error('Error checking parent relationships:', checkError)
        toast.error('Error checking parent relationships')
        return
      }

      if (studentRelationships && studentRelationships.length > 0) {
        toast.error('Cannot delete parent: This parent has students linked to them. Please unlink all students first.')
        return
      }

      if (!confirm('Are you sure you want to delete this parent? This action cannot be undone.')) {
        return
      }

      // Delete the parent (no relationships to delete since we checked above)
      const { error } = await supabase
        .from('parents')
        .delete()
        .eq('id', parentId)

      if (error) {
        console.error('Error deleting parent:', error)
        toast.error('Error deleting parent')
        return
      }

      await fetchParents() // Refresh the parents list
      toast.success('Parent deleted successfully!')
    } catch (error) {
      console.error('Error deleting parent:', error)
      toast.error('Error deleting parent')
    }
  }

  const handleAddParent = async (parentData: { name: string; email: string; password: string }) => {
    try {
      // Check if parent with this email already exists
      const { data: existingParent, error: checkError } = await supabase
        .from('parents')
        .select('*')
        .eq('email', parentData.email.trim())
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing parent:', checkError)
        toast.error('Error checking existing parent')
        return
      }

      if (existingParent) {
        toast.error('A parent with this email already exists')
        return
      }

      // Create parent using API endpoint
      const response = await fetch('/api/create-parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: parentData.email.trim(),
          password: parentData.password.trim(),
          name: parentData.name.trim()
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        toast.error('Error creating parent account. Please check the console for details.')
        return
      }

      const result = await response.json()

      if (result.success && result.parent) {
        setIsAddDialogOpen(false)
        await fetchParents() // Refresh the parents list
        toast.success('Parent created successfully!')
      } else {
        console.error('API returned error:', result)
        toast.error('Error creating parent account: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error creating parent:', error)
      toast.error('Error creating parent')
    }
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

// Add Parent Form Component
function AddParentForm({ 
  onSubmit 
}: { 
  onSubmit: (data: { name: string; email: string; password: string }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!name.trim()) {
      toast.error('Please enter a parent name')
      return
    }
    
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }
    
    if (!password.trim()) {
      toast.error('Please enter a password')
      return
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }
    
    setLoading(true)
    await onSubmit({ 
      name: name.trim(), 
      email: email.trim(), 
      password: password.trim() 
    })
    setLoading(false)
    
    // Reset form
    setName('')
    setEmail('')
    setPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="parentName" className="text-sm font-medium">
          Parent Name *
        </label>
        <Input
          id="parentName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter parent name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="parentEmail" className="text-sm font-medium">
          Email *
        </label>
        <Input
          id="parentEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter parent email"
          required
        />
        <p className="text-xs text-gray-500">
          Parents need email to log in and check their child's progress
        </p>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="parentPassword" className="text-sm font-medium">
          Password *
        </label>
        <Input
          id="parentPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password for parent"
          required
        />
        <p className="text-xs text-gray-500">
          Choose a password that the parent can remember easily
        </p>
      </div>
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating...' : 'Create Parent'}
      </Button>
    </form>
  )
}

// Edit Parent Form Component
function EditParentForm({ 
  parent, 
  onSubmit 
}: { 
  parent: Parent
  onSubmit: (data: { id: string; name: string; email: string; password?: string }) => void
}) {
  const [name, setName] = useState(parent.name)
  const [email, setEmail] = useState(parent.email || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!name.trim()) {
      toast.error('Please enter a parent name')
      return
    }
    
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }
    
    setLoading(true)
    await onSubmit({ 
      id: parent.id,
      name: name.trim(), 
      email: email.trim(), 
      password: password.trim() || undefined
    })
    setLoading(false)
    
    // Reset form
    setName(parent.name)
    setEmail(parent.email || '')
    setPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="editParentName" className="text-sm font-medium">
          Parent Name *
        </label>
        <Input
          id="editParentName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter parent name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editParentEmail" className="text-sm font-medium">
          Email *
        </label>
        <Input
          id="editParentEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter parent email"
          required
        />
        <p className="text-xs text-gray-500">
          Parents need email to log in and check their child's progress
        </p>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="editParentPassword" className="text-sm font-medium">
          New Password (optional)
        </label>
        <Input
          id="editParentPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to keep current password"
        />
        <p className="text-xs text-gray-500">
          Only fill this if you want to change the password
        </p>
      </div>
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating...' : 'Update Parent'}
      </Button>
    </form>
  )
}

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Parent Management
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage parents of your students
              </p>
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
                    Create a new parent account with login credentials
                  </DialogDescription>
                </DialogHeader>
                <AddParentForm onSubmit={handleAddParent} />
              </DialogContent>
            </Dialog>
            
            {/* Edit Parent Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Parent</DialogTitle>
                  <DialogDescription>
                    Update parent information and credentials
                  </DialogDescription>
                </DialogHeader>
                {editingParent && (
                  <EditParentForm 
                    parent={editingParent}
                    onSubmit={handleEditParent} 
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
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
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingParent(parent)
                                setIsEditDialogOpen(true)
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Parent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className={parent.students && parent.students.length > 0 ? "text-gray-400 cursor-not-allowed" : "text-red-600"}
                                onClick={() => {
                                  if (parent.students && parent.students.length > 0) {
                                    toast.error('Cannot delete parent: This parent has students linked to them. Please unlink all students first.')
                                  } else {
                                    handleDeleteParent(parent.id)
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Parent
                                {parent.students && parent.students.length > 0 && (
                                  <span className="ml-2 text-xs">(Has students)</span>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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