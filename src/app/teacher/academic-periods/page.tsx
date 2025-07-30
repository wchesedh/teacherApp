'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  CheckCircle, 
  Clock,
  AlertCircle,
  Info,
  Power,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useActivePeriod } from '@/contexts/ActivePeriodContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

interface AcademicPeriod {
  id: string
  name: string
  type: 'semester' | 'quarter' | 'trimester' | 'term'
  start_date: string
  end_date: string
  is_active: boolean
  school_year: string
  created_at?: string
  updated_at?: string
}

const editPeriodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['semester', 'quarter', 'trimester', 'term']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  school_year: z.string().min(1, 'School year is required'),
})

type EditPeriodForm = z.infer<typeof editPeriodSchema>

export default function AcademicPeriodsPage() {
  const { user } = useAuth()
  const { setActivePeriod: setGlobalActivePeriod, refreshActivePeriod } = useActivePeriod()
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [activePeriod, setActivePeriod] = useState<AcademicPeriod | null>(null)
  const [changingActive, setChangingActive] = useState<string | null>(null)
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deletingPeriod, setDeletingPeriod] = useState<string | null>(null)

  const editForm = useForm<EditPeriodForm>({
    resolver: zodResolver(editPeriodSchema),
    defaultValues: {
      name: '',
      type: 'semester',
      start_date: '',
      end_date: '',
      school_year: '',
    },
  })

  useEffect(() => {
    if (user) {
      fetchPeriods()
    }
  }, [user])

  const fetchPeriods = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data: periodsData, error } = await supabase
        .from('academic_periods')
        .select('*')
        .order('school_year', { ascending: false })
        .order('start_date', { ascending: false })

      if (error) {
        console.error('Error fetching periods:', error)
        toast.error('Error loading academic periods')
        return
      }

      setPeriods(periodsData || [])
      
      // Find the active period
      const active = periodsData?.find(period => period.is_active)
      setActivePeriod(active || null)

    } catch (error) {
      console.error('Error fetching periods:', error)
      toast.error('Error loading academic periods')
    } finally {
      setLoading(false)
    }
  }

  const changeActivePeriod = async (periodId: string) => {
    if (!user) return

    // Get the period name for confirmation
    const periodToActivate = periods.find(p => p.id === periodId)
    if (!periodToActivate) return

    // Confirm the action
    if (!confirm(`Are you sure you want to set "${periodToActivate.name}" as the active academic period? This will affect all classes and posts in the system.`)) {
      return
    }

    try {
      setChangingActive(periodId)
      
      // First, deactivate all periods
      const { error: deactivateError } = await supabase
        .from('academic_periods')
        .update({ is_active: false })
        .eq('is_active', true)

      if (deactivateError) {
        console.error('Error deactivating periods:', deactivateError)
        toast.error('Error changing active period')
        return
      }

      // Then, activate the selected period
      const { error: activateError } = await supabase
        .from('academic_periods')
        .update({ is_active: true })
        .eq('id', periodId)

      if (activateError) {
        console.error('Error activating period:', activateError)
        toast.error('Error changing active period')
        return
      }

      // Refresh the periods data
      await fetchPeriods()
      
      // Refresh the global active period context
      await refreshActivePeriod()
      
      toast.success('Active period changed successfully!')
      
    } catch (error) {
      console.error('Error changing active period:', error)
      toast.error('Error changing active period')
    } finally {
      setChangingActive(null)
    }
  }

  const openEditDialog = (period: AcademicPeriod) => {
    setEditingPeriod(period)
    editForm.reset({
      name: period.name,
      type: period.type,
      start_date: period.start_date.split('T')[0], // Convert to YYYY-MM-DD format
      end_date: period.end_date.split('T')[0],
      school_year: period.school_year,
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (data: EditPeriodForm) => {
    if (!editingPeriod) return

    try {
      const { error } = await supabase
        .from('academic_periods')
        .update({
          name: data.name,
          type: data.type,
          start_date: data.start_date,
          end_date: data.end_date,
          school_year: data.school_year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPeriod.id)

      if (error) {
        console.error('Error updating period:', error)
        toast.error('Error updating academic period')
        return
      }

      toast.success('Academic period updated successfully!')
      setIsEditDialogOpen(false)
      setEditingPeriod(null)
      await fetchPeriods()
      
      // Refresh the global active period context if the edited period was active
      if (editingPeriod.is_active) {
        await refreshActivePeriod()
      }
      
    } catch (error) {
      console.error('Error updating period:', error)
      toast.error('Error updating academic period')
    }
  }

  const handleDelete = async (periodId: string) => {
    const periodToDelete = periods.find(p => p.id === periodId)
    if (!periodToDelete) return

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${periodToDelete.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingPeriod(periodId)
      
      const { error } = await supabase
        .from('academic_periods')
        .delete()
        .eq('id', periodId)

      if (error) {
        console.error('Error deleting period:', error)
        toast.error('Error deleting academic period')
        return
      }

      toast.success('Academic period deleted successfully!')
      await fetchPeriods()
      
      // Refresh the global active period context if the deleted period was active
      if (periodToDelete.is_active) {
        await refreshActivePeriod()
      }
      
    } catch (error) {
      console.error('Error deleting period:', error)
      toast.error('Error deleting academic period')
    } finally {
      setDeletingPeriod(null)
    }
  }

  const getPeriodTypeIcon = (type: string) => {
    switch (type) {
      case 'semester':
        return <Calendar className="w-4 h-4" />
      case 'quarter':
        return <Clock className="w-4 h-4" />
      case 'trimester':
        return <Calendar className="w-4 h-4" />
      case 'term':
        return <Calendar className="w-4 h-4" />
      default:
        return <Calendar className="w-4 h-4" />
    }
  }

  const getPeriodTypeColor = (type: string) => {
    switch (type) {
      case 'semester':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'quarter':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'trimester':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'term':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const isCurrentPeriod = (period: AcademicPeriod) => {
    const now = new Date()
    const startDate = new Date(period.start_date)
    const endDate = new Date(period.end_date)
    return now >= startDate && now <= endDate
  }

  const getPeriodStatus = (period: AcademicPeriod) => {
    if (period.is_active) {
      return { status: 'Active', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle }
    } else if (isCurrentPeriod(period)) {
      return { status: 'Current', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info }
    } else {
      const now = new Date()
      const startDate = new Date(period.start_date)
      if (now < startDate) {
        return { status: 'Upcoming', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock }
      } else {
        return { status: 'Past', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle }
      }
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading academic periods...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Academic Periods
          </h1>
          <p className="text-gray-600 mt-2">
            View and manage academic periods for your classes
          </p>
        </div>

        {/* Active Period Card */}
        {activePeriod && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span>Currently Active Period</span>
              </CardTitle>
              <CardDescription className="text-green-700">
                This is the academic period that is currently active across the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-900">{activePeriod.name}</h3>
                  <p className="text-sm text-green-700">
                    {new Date(activePeriod.start_date).toLocaleDateString()} - {new Date(activePeriod.end_date).toLocaleDateString()}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="secondary" className={getPeriodTypeColor(activePeriod.type)}>
                      {getPeriodTypeIcon(activePeriod.type)}
                      <span className="ml-1 capitalize">{activePeriod.type}</span>
                    </Badge>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      {activePeriod.school_year}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-700">School Year</p>
                  <p className="text-lg font-semibold text-green-900">{activePeriod.school_year}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Periods */}
        <Card>
          <CardHeader>
            <CardTitle>All Academic Periods</CardTitle>
            <CardDescription>
              View all academic periods in the system. Click "Set Active" to change the active period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Academic Periods</h3>
                <p className="text-gray-600">
                  No academic periods have been set up yet. Contact an administrator to create periods.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {periods.map((period) => {
                  const status = getPeriodStatus(period)
                  const StatusIcon = status.icon
                  
                  return (
                    <div key={period.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900">{period.name}</h3>
                            <Badge variant="secondary" className={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge variant="secondary" className={getPeriodTypeColor(period.type)}>
                              {getPeriodTypeIcon(period.type)}
                              <span className="ml-1 capitalize">{period.type}</span>
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {period.school_year}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Duration</p>
                            <p className="text-sm font-medium text-gray-900">
                              {Math.ceil((new Date(period.end_date).getTime() - new Date(period.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!period.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => changeActivePeriod(period.id)}
                                disabled={changingActive === period.id}
                                className="border-green-200 text-green-700 hover:bg-green-50"
                              >
                                {changingActive === period.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4 mr-1" />
                                    Set Active
                                  </>
                                )}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(period)}
                                  className="cursor-pointer"
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(period.id)}
                                  className="cursor-pointer text-red-600 focus:text-red-600"
                                  disabled={deletingPeriod === period.id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {deletingPeriod === period.id ? 'Deleting...' : 'Delete'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800">
              <Info className="w-5 h-5" />
              <span>About Academic Periods</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700">
            <div className="space-y-2 text-sm">
              <p>
                <strong>Active Period:</strong> This is the current academic period that determines which classes and posts are visible to teachers and parents.
              </p>
              <p>
                <strong>Current Period:</strong> A period that is currently running based on its start and end dates, but may not be the active period.
              </p>
              <p>
                <strong>Upcoming Period:</strong> A period that hasn't started yet but is scheduled for the future.
              </p>
              <p>
                <strong>Past Period:</strong> A period that has already ended.
              </p>
              <p className="mt-4 text-xs">
                <strong>Note:</strong> You can change the active period by clicking the "Set Active" button on any period card. Only one period can be active at a time.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Academic Period</DialogTitle>
              <DialogDescription>
                Make changes to the academic period details here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter period name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select period type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="semester">Semester</SelectItem>
                          <SelectItem value="quarter">Quarter</SelectItem>
                          <SelectItem value="trimester">Trimester</SelectItem>
                          <SelectItem value="term">Term</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="school_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Year</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2023-2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
} 