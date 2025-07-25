'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface AcademicPeriod {
  id: string
  name: string
  type: string
  school_year: string
  start_date: string
  end_date: string
  is_active: boolean
}

interface Class {
  id: string
  name: string
  teacher_id: string
  created_at: string
  academic_period_id: string | null
  is_active: boolean
  academic_period?: AcademicPeriod
}

export default function ClassManagement() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)

  useEffect(() => {
    if (user) {
      // Load classes immediately without showing loading state
      fetchClassesOptimized()
      fetchAcademicPeriods()
    }
  }, [user])

  const fetchClassesOptimized = async () => {
    if (!user) {
      console.error('fetchClasses called but user is not loaded')
      return
    }
    
    try {
      // Start with empty array to show page immediately
      setClasses([])
      
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          academic_period:academic_periods(*)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching classes:', error, 'user:', user)
        toast.error('Error fetching classes')
      } else {
        setClasses(data || [])
      }
    } catch (error) {
      console.error('Error fetching classes (exception):', error, 'user:', user)
      toast.error('Error fetching classes')
    }
  }

  const fetchAcademicPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_periods')
        .select('*')
        .order('school_year', { ascending: false })
        .order('start_date', { ascending: false })
      
      if (error) {
        console.error('Error fetching academic periods:', error)
      } else {
        setAcademicPeriods(data || [])
      }
    } catch (error) {
      console.error('Error fetching academic periods:', error)
    }
  }

  const filteredClasses = classes.filter(classItem =>
    classItem.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddClass = async (classData: { name: string; academic_period_id?: string }) => {
    try {
      const { data: newClass, error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          teacher_id: user?.id,
          academic_period_id: classData.academic_period_id || null
        }])
        .select(`
          *,
          academic_period:academic_periods(*)
        `)
        .single()

      if (error) {
        console.error('Error adding class:', error)
        toast.error('Error creating class: ' + error.message)
        return
      }

      // Optimistic update
      if (newClass) {
        setClasses(prev => [newClass, ...prev])
      }
      
      setIsAddDialogOpen(false)
      toast.success('Class created successfully!')
    } catch (error) {
      console.error('Error adding class:', error)
      toast.error('Error creating class')
    }
  }

  const handleEditClass = async (classData: { name: string; academic_period_id?: string }) => {
    if (!editingClass) return

    try {
      const { data: updatedClass, error } = await supabase
        .from('classes')
        .update({ 
          name: classData.name,
          academic_period_id: classData.academic_period_id || null
        })
        .eq('id', editingClass.id)
        .select(`
          *,
          academic_period:academic_periods(*)
        `)
        .single()

      if (error) {
        console.error('Error updating class:', error)
        toast.error('Error updating class: ' + error.message)
        return
      }

      // Optimistic update
      if (updatedClass) {
        setClasses(prev => prev.map(c => c.id === editingClass.id ? updatedClass : c))
      }
      
      setIsEditDialogOpen(false)
      setEditingClass(null)
      toast.success('Class updated successfully!')
    } catch (error) {
      console.error('Error updating class:', error)
      toast.error('Error updating class')
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) {
      return
    }

    try {
      // Optimistic update
      setClasses(prev => prev.filter(c => c.id !== classId))
      
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)

      if (error) {
        console.error('Error deleting class:', error)
        toast.error('Error deleting class: ' + error.message)
        // Revert optimistic update
        await fetchClassesOptimized()
      } else {
        toast.success('Class deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting class:', error)
      toast.error('Error deleting class')
      // Revert optimistic update
      await fetchClassesOptimized()
    }
  }

  const openEditDialog = (classItem: Class) => {
    setEditingClass(classItem)
    setIsEditDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getPeriodTypeColor = (type: string) => {
    switch (type) {
      case 'semester': return 'bg-blue-100 text-blue-800'
      case 'quarter': return 'bg-green-100 text-green-800'
      case 'trimester': return 'bg-purple-100 text-purple-800'
      case 'term': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>My Classes</CardTitle>
            <CardDescription>
              Manage your classes ({classes.length} classes)
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
                  Create a new class for your students
                </DialogDescription>
              </DialogHeader>
              <AddClassForm onSubmit={handleAddClass} academicPeriods={academicPeriods} />
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
                <TableHead>Academic Period</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
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
                      {classItem.academic_period ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Badge className={getPeriodTypeColor(classItem.academic_period.type)}>
                              {classItem.academic_period.type}
                            </Badge>
                            {classItem.academic_period.is_active && (
                              <Badge className="bg-green-100 text-green-800">
                                Active
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {classItem.academic_period.name}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDate(classItem.academic_period.start_date)} - {formatDate(classItem.academic_period.end_date)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No period assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(classItem.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={`/teacher/classes/${classItem.id}/posts`}>
                            Announcements
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <a href={`/teacher/classes/${classItem.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Students
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(classItem)}>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Class Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update the class name and academic period
            </DialogDescription>
          </DialogHeader>
          {editingClass && (
            <EditClassForm 
              onSubmit={handleEditClass} 
              initialName={editingClass.name}
              initialAcademicPeriodId={editingClass.academic_period_id}
              academicPeriods={academicPeriods}
              onCancel={() => {
                setIsEditDialogOpen(false)
                setEditingClass(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// Add Class Form Component
function AddClassForm({ 
  onSubmit, 
  academicPeriods 
}: { 
  onSubmit: (data: { name: string; academic_period_id?: string }) => void
  academicPeriods: AcademicPeriod[]
}) {
  const [name, setName] = useState('')
  const [academicPeriodId, setAcademicPeriodId] = useState<string>('none')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ 
      name, 
      academic_period_id: academicPeriodId === 'none' ? undefined : academicPeriodId 
    })
    
    setName('')
    setAcademicPeriodId('none')
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
        <label htmlFor="academicPeriod" className="text-sm font-medium">
          Academic Period (Optional)
        </label>
        <Select value={academicPeriodId} onValueChange={setAcademicPeriodId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an academic period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No period assigned</SelectItem>
            {academicPeriods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                <div className="flex flex-col">
                  <span>{period.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(period.start_date)} - {formatDate(period.end_date)}
                  </span>
                </div>
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

// Edit Class Form Component
function EditClassForm({ 
  onSubmit, 
  initialName, 
  initialAcademicPeriodId,
  academicPeriods,
  onCancel 
}: { 
  onSubmit: (data: { name: string; academic_period_id?: string }) => void
  initialName: string
  initialAcademicPeriodId: string | null
  academicPeriods: AcademicPeriod[]
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [academicPeriodId, setAcademicPeriodId] = useState<string>(initialAcademicPeriodId || 'none')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Please enter a class name')
      return
    }
    
    setLoading(true)
    
    await onSubmit({ 
      name: name.trim(), 
      academic_period_id: academicPeriodId === 'none' ? undefined : academicPeriodId 
    })
    
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="editName" className="text-sm font-medium">
          Class Name
        </label>
        <Input
          id="editName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter class name"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="editAcademicPeriod" className="text-sm font-medium">
          Academic Period (Optional)
        </label>
        <Select value={academicPeriodId} onValueChange={setAcademicPeriodId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an academic period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No period assigned</SelectItem>
            {academicPeriods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                <div className="flex flex-col">
                  <span>{period.name}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(period.start_date)} - {formatDate(period.end_date)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Updating...' : 'Update Class'}
        </Button>
      </div>
    </form>
  )
}

// Helper function to format dates
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
} 