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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Calendar, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { AcademicPeriod } from '@/lib/supabase'

export default function AcademicPeriodManagement() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    fetchPeriods()
  }, [])

  const fetchPeriods = async () => {
    try {
      setLoading(true)
      
      const { data: periodsData, error } = await supabase
        .from('academic_periods')
        .select('*')
        .order('school_year', { ascending: false })
        .order('start_date', { ascending: false })

      if (error) {
        console.error('Error fetching periods:', error)
        toast.error(`Error fetching periods: ${error.message}`)
      } else {
        setPeriods(periodsData || [])
      }
    } catch (error) {
      console.error('Exception fetching periods:', error)
      toast.error('Error fetching periods')
    } finally {
      setLoading(false)
    }
  }

  const filteredPeriods = periods.filter(period =>
    period.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    period.school_year.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddPeriod = async (periodData: {
    name: string
    type: 'semester' | 'quarter' | 'trimester' | 'term'
    start_date: string
    end_date: string
    school_year: string
    is_active: boolean
  }) => {
    try {
      const { error } = await supabase
        .from('academic_periods')
        .insert([periodData])

      if (error) {
        console.error('Error adding period:', error)
        toast.error('Error creating period: ' + error.message)
        return
      }

      await fetchPeriods()
      setIsAddDialogOpen(false)
      toast.success('Academic period created successfully!')
    } catch (error) {
      console.error('Error adding period:', error)
      toast.error('Error creating period')
    }
  }

  const handleDeletePeriod = async (periodId: string) => {
    if (!confirm('Are you sure you want to delete this academic period? This will affect all classes associated with it.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('academic_periods')
        .delete()
        .eq('id', periodId)

      if (error) {
        console.error('Error deleting period:', error)
        toast.error('Error deleting period: ' + error.message)
      } else {
        await fetchPeriods()
        toast.success('Academic period deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting period:', error)
      toast.error('Error deleting period')
    }
  }

  const handleSetActive = async (periodId: string) => {
    try {
      const { error } = await supabase
        .from('academic_periods')
        .update({ is_active: true })
        .eq('id', periodId)

      if (error) {
        console.error('Error setting period as active:', error)
        toast.error('Error setting period as active: ' + error.message)
      } else {
        await fetchPeriods()
        toast.success('Academic period set as active!')
      }
    } catch (error) {
      console.error('Error setting period as active:', error)
      toast.error('Error setting period as active')
    }
  }

  const getTypeColor = (type: string) => {
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
            <CardTitle>Academic Periods</CardTitle>
            <CardDescription>
              Manage semesters, quarters, and other academic periods ({periods.length} periods)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Period
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Academic Period</DialogTitle>
                <DialogDescription>
                  Create a new semester, quarter, or other academic period
                </DialogDescription>
              </DialogHeader>
              <AddPeriodForm onSubmit={handleAddPeriod} />
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
              placeholder="Search periods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Periods Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>School Year</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading periods...
                  </TableCell>
                </TableRow>
              ) : filteredPeriods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No academic periods found. Add your first period using the "Add Period" button above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {period.name}
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(period.type)}>
                        {period.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {period.school_year}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="mr-1 h-4 w-4" />
                        {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {period.is_active ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!period.is_active && (
                            <DropdownMenuItem onClick={() => handleSetActive(period.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Set as Active
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Period
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeletePeriod(period.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Period
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

// Add Period Form Component
function AddPeriodForm({ 
  onSubmit 
}: { 
  onSubmit: (data: {
    name: string
    type: 'semester' | 'quarter' | 'trimester' | 'term'
    start_date: string
    end_date: string
    school_year: string
    is_active: boolean
  }) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'semester' | 'quarter' | 'trimester' | 'term'>('semester')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    await onSubmit({ 
      name, 
      type, 
      start_date: startDate, 
      end_date: endDate, 
      school_year: schoolYear,
      is_active: isActive
    })
    
    setName('')
    setType('semester')
    setStartDate('')
    setEndDate('')
    setSchoolYear('')
    setIsActive(false)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Period Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Fall Semester 2024"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="type" className="text-sm font-medium">
          Period Type
        </label>
        <Select value={type} onValueChange={(value: 'semester' | 'quarter' | 'trimester' | 'term') => setType(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select period type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semester">Semester</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="trimester">Trimester</SelectItem>
            <SelectItem value="term">Term</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start Date
          </label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="endDate" className="text-sm font-medium">
            End Date
          </label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="schoolYear" className="text-sm font-medium">
          School Year
        </label>
        <Input
          id="schoolYear"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="e.g., 2024-2025"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="isActive" className="text-sm font-medium">
          Set as active period
        </label>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Period...' : 'Add Period'}
      </Button>
    </form>
  )
} 