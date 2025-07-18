'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Mail, 
  Calendar,
  Camera,
  Edit,
  Save,
  X,
  Users,
  GraduationCap,
  MessageSquare,
  Settings,
  Heart
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import { formatFullName } from '@/lib/utils'

interface Parent {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
  email: string
  created_at?: string
  avatar_url?: string
  bio?: string
  phone?: string
  children?: Child[]
}

interface Child {
  id: string
  name: string
  class_id: string
  created_at?: string
  class?: Class
}

interface Class {
  id: string
  name: string
  teacher_id: string
  created_at?: string
}

export default function ParentProfilePage() {
  const { user } = useAuth()
  const [parent, setParent] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [stats, setStats] = useState({
    children: 0,
    classes: 0,
    messages: 0
  })
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    email: '',
    bio: '',
    phone: ''
  })

  useEffect(() => {
    if (user) {
      fetchParentProfile()
    }
  }, [user])

  const fetchParentProfile = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch parent info with children
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select(`
          *,
          student_parent (
            student_id,
            students (
              id,
              name,
              class_id,
              created_at,
              classes (
                id,
                name,
                teacher_id,
                created_at
              )
            )
          )
        `)
        .eq('id', user.id)
        .single()

      if (parentError) {
        console.error('Error fetching parent:', parentError)
        toast.error('Error fetching parent profile')
        return
      }

      // Transform the data to match our interface
      const children = parentData.student_parent?.map((sp: any) => ({
        id: sp.students.id,
        name: sp.students.name,
        class_id: sp.students.class_id,
        created_at: sp.students.created_at,
        class: sp.students.classes
      })) || []

      const parentWithChildren = {
        ...parentData,
        children
      }

      setParent(parentWithChildren)
      setEditForm({
        first_name: parentData.first_name || '',
        middle_name: parentData.middle_name || '',
        last_name: parentData.last_name || '',
        suffix: parentData.suffix || '',
        email: parentData.email || '',
        bio: parentData.bio || '',
        phone: parentData.phone || ''
      })

      // Fetch stats
      await fetchParentStats()

    } catch (error) {
      console.error('Error fetching parent profile:', error)
      toast.error('Error fetching parent profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchParentStats = async () => {
    if (!user) return

    try {
      // Get unique classes from children
      const uniqueClasses = new Set(parent?.children?.map(child => child.class_id) || [])
      
      setStats({
        children: parent?.children?.length || 0,
        classes: uniqueClasses.size,
        messages: 0 // Placeholder for future message count
      })

    } catch (error) {
      console.error('Error fetching parent stats:', error)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!user) return

    try {
      setUploadingAvatar(true)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `parent-avatars/${fileName}`

      console.log('Attempting to upload file:', {
        fileName,
        filePath,
        fileSize: file.size,
        fileType: file.type
      })

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          name: uploadError.name
        })
        
        // Check if it's a bucket not found error
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          toast.error('Storage bucket not found. Please create an "avatars" bucket in Supabase Storage.')
        } else if (uploadError.message?.includes('policy') || uploadError.message?.includes('permission')) {
          toast.error('Storage permission denied. Please check storage policies.')
        } else {
          toast.error(`Error uploading avatar: ${uploadError.message}`)
        }
        return
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      console.log('Public URL:', publicUrl)

      // Update parent record
      const { error: updateError } = await supabase
        .from('parents')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating avatar in database:', updateError)
        toast.error('Error updating avatar in database: ' + updateError.message)
        return
      }

      // Update local state
      setParent(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      toast.success('Avatar updated successfully!')
      setShowAvatarDialog(false)

    } catch (error) {
      console.error('Unexpected error during avatar upload:', error)
      toast.error('Unexpected error uploading avatar. Please try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('parents')
        .update({
          first_name: editForm.first_name,
          middle_name: editForm.middle_name,
          last_name: editForm.last_name,
          suffix: editForm.suffix,
          email: editForm.email,
          bio: editForm.bio,
          phone: editForm.phone
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating profile:', error)
        toast.error('Error updating profile')
        return
      }

      setParent(prev => prev ? { ...prev, ...editForm } : null)
      setEditMode(false)
      toast.success('Profile updated successfully!')

    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Error updating profile')
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading profile...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!parent) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Parent profile not found</p>
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
            Parent Profile
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your personal information and view your children
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Personal Information</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {editMode ? 'Cancel' : 'Edit'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="text-center">
                  <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                      {parent.avatar_url ? (
                        <img 
                          src={parent.avatar_url} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0"
                      onClick={() => setShowAvatarDialog(true)}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="space-y-4">
                  {editMode && (
                    <>
                      <div>
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          value={editForm.first_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter first name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="middle_name">Middle Name</Label>
                        <Input
                          id="middle_name"
                          value={editForm.middle_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter middle name (optional)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          value={editForm.last_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter last name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="suffix">Suffix</Label>
                        <Input
                          id="suffix"
                          value={editForm.suffix}
                          onChange={(e) => setEditForm(prev => ({ ...prev, suffix: e.target.value }))}
                          className="mt-1"
                          placeholder="Enter suffix (e.g., Jr., Sr., III) (optional)"
                        />
                      </div>
                    </>
                  )}

                  {/* Display full name when not in edit mode */}
                  {!editMode && (
                    <div>
                      <Label>Full Name</Label>
                      <p className="text-xl font-semibold mt-1 text-gray-900">
                        {formatFullName(parent.first_name, parent.last_name, parent.middle_name, parent.suffix)}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email">Email</Label>
                    {editMode ? (
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{parent.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    {editMode ? (
                      <Input
                        id="phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="mt-1"
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{parent.phone || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    {editMode ? (
                      <textarea
                        id="bio"
                        value={editForm.bio}
                        onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        rows={3}
                        placeholder="Tell us about yourself..."
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{parent.bio || 'No bio provided'}</p>
                    )}
                  </div>

                  <div>
                    <Label>Member Since</Label>
                    <p className="text-gray-600 mt-1">
                      {parent.created_at ? new Date(parent.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>

                  {editMode && (
                    <div className="flex space-x-2 pt-4">
                      <Button onClick={handleSaveProfile} className="flex-1">
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setEditMode(false)}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Children and Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.children}</p>
                      <p className="text-sm text-gray-600">Children</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.classes}</p>
                      <p className="text-sm text-gray-600">Classes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.messages}</p>
                      <p className="text-sm text-gray-600">Messages</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Children Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="w-5 h-5" />
                  <span>My Children</span>
                </CardTitle>
                <CardDescription>
                  View your children and their classes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {parent.children && parent.children.length > 0 ? (
                  <div className="space-y-4">
                    {parent.children.map((child) => (
                      <div key={child.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-lg">{child.name}</h3>
                            {child.class && (
                              <p className="text-sm text-gray-600">
                                Class: {child.class.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              Joined: {child.created_at ? new Date(child.created_at).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              View Progress
                            </Button>
                            <Button size="sm" variant="outline">
                              Messages
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Yet</h3>
                    <p className="text-gray-600">
                      Your children will appear here once they are added to classes by teachers.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-auto p-4 flex-col space-y-2">
                    <MessageSquare className="w-6 h-6" />
                    <span>Send Message</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex-col space-y-2">
                    <GraduationCap className="w-6 h-6" />
                    <span>View Classes</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex-col space-y-2">
                    <Users className="w-6 h-6" />
                    <span>View Children</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex-col space-y-2">
                    <Settings className="w-6 h-6" />
                    <span>Account Settings</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Avatar Upload Dialog */}
        <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Profile Picture</DialogTitle>
              <DialogDescription>
                Upload a new profile picture. Supported formats: JPG, PNG, GIF (max 5MB)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="avatar">Choose Image</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Image size must be less than 5MB')
                        return
                      }
                      handleAvatarUpload(file)
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAvatarDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  )
} 