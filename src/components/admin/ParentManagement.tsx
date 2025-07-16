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
import { toast } from 'sonner'

interface Parent {
  id: string
  name: string
  email: string | null
  created_at?: string
}

export default function ParentManagement() {
  const [parents, setParents] = useState<Parent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    testDatabaseConnection()
    fetchParents()
  }, [])

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection for parents...')
      
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
      
      // Test if we can access the parents table and see its structure
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .limit(1)
      
      console.log('Database connection test result:', { data, error })
      
      if (data && data.length > 0) {
        console.log('Parents table structure (sample row):', data[0])
        console.log('Available columns:', Object.keys(data[0]))
      }
      
      if (error) {
        console.error('Database connection failed:', error)
        console.error('This might mean:')
        console.error('1. The parents table does not exist')
        console.error('2. RLS policies are blocking access')
        console.error('3. The user does not have permission')
      } else {
        console.log('Database connection successful')
      }
    } catch (error) {
      console.error('Exception during database connection test:', error)
    }
  }

  const fetchParents = async () => {
    try {
      setLoading(true)
      console.log('Fetching parents from database...')
      
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
      
      // Query the parents table
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .order('created_at', { ascending: false })
      
      console.log('Supabase response:', { data, error })
      
      if (error) {
        console.error('Error fetching parents:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        toast.error(`Error fetching parents: ${error.message}`)
      } else {
        console.log('Parents fetched successfully:', data)
        setParents(data || [])
      }
    } catch (error) {
      console.error('Exception fetching parents:', error)
      console.error('Error type:', typeof error)
      console.error('Error object:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error fetching parents: ${errorMessage}`)
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
            <CardTitle>Parent Management</CardTitle>
            <CardDescription>
              Manage all parents in the system ({parents.length} parents)
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
                      {parent.created_at ? new Date(parent.created_at).toLocaleDateString() : 'N/A'}
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