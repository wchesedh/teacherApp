'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  GraduationCap, 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  ArrowLeft,
  BookOpen,
  Camera,
  Edit,
  Save,
  X,
  Settings,
  Users
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import { toast } from 'sonner'
import Link from 'next/link'
import { formatFullName } from '@/lib/utils'

interface Student {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  suffix?: string
  class_id: string
  created_at: string
  avatar_url?: string
  bio?: string
  grade?: string
  age?: number | null
}

interface Class {
  id: string
  name: string
  teacher_id: string
  teacher?: Teacher
}

interface Teacher {
  id: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  name: string
  email: string
}

interface Post {
  id: string
  content: string
  created_at: string
  teacher?: Teacher
}

export default function ParentStudentProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const studentId = params.id as string
  
  const [student, setStudent] = useState<Student | null>(null)
  const [classInfo, setClassInfo] = useState<Class | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [stats, setStats] = useState({
    posts: 0,
    teachers: 0,
    classmates: 0
  })
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    bio: '',
    grade: '',
    age: ''
  })

  useEffect(() => {
    if (studentId) {
      fetchStudentDetails()
    }
  }, [studentId])

  const fetchStudentDetails = async () => {
    try {
      setLoading(true)

      // Verify this student belongs to this parent
      const { data: studentParentData, error: studentParentError } = await supabase
        .from('student_parent')
        .select('student_id')
        .eq('student_id', studentId)
        .eq('parent_id', user?.id)
        .single()

      if (studentParentError || !studentParentData) {
        toast.error('You can only view your own children')
        return
      }

      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) {
        console.error('Error fetching student:', studentError)
        toast.error('Error fetching student details')
        return
      }

      setStudent(studentData)
      setEditForm({
        first_name: studentData.first_name || '',
        middle_name: studentData.middle_name || '',
        last_name: studentData.last_name || '',
        suffix: studentData.suffix || '',
        bio: studentData.bio || '',
        grade: studentData.grade || '',
        age: studentData.age?.toString() || ''
      })

      // Fetch class information
      let classData: Class | null = null
      if (studentData.class_id) {
        const { data: classResult, error: classError } = await supabase
          .from('classes')
          .select(`
            *,
            teachers (
              id,
              first_name,
              middle_name,
              last_name,
              suffix,
              name,
              email
            )
          `)
          .eq('id', studentData.class_id)
          .single()

        if (classError) {
          console.error('Error fetching class:', classError)
        } else {
          classData = classResult
          setClassInfo(classResult)
        }
      }

      // Fetch posts for this student
      const { data: tagData, error: tagError } = await supabase
        .from('post_student_tags')
        .select(`
          post_id,
          posts (
            id,
            content,
            created_at,
            teachers (
              id,
              first_name,
              middle_name,
              last_name,
              suffix,
              name,
              email
            )
          )
        `)
        .eq('student_id', studentId)

      if (tagError) {
        console.error('Error fetching post tags:', tagError)
        setPosts([])
      } else if (tagData && tagData.length > 0) {
        // Transform posts data
        const postsData = tagData.map((item: any) => ({
          id: item.posts.id,
          content: item.posts.content,
          created_at: item.posts.created_at,
          teacher: item.posts.teachers
        }))
        
        setPosts(postsData)
      } else {
        setPosts([])
      }

      // Fetch stats after all data is loaded
      await fetchStudentStats(studentData, classData)

    } catch (error) {
      console.error('Error fetching student details:', error)
      toast.error('Error fetching student details')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudentStats = async (studentData?: Student, classData?: Class | null) => {
    const currentStudent = studentData || student
    const currentClassInfo = classData || classInfo
    
    if (!currentStudent) return

    try {
      // Count posts for this student
      const { count: postsCount, error: postsError } = await supabase
        .from('post_student_tags')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', currentStudent.id)

      // Count classmates (students in the same class)
      const { count: classmatesCount, error: classmatesError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', currentStudent.class_id)

      // Count teachers (usually 1, but could be more if multiple teachers per class)
      let teachersCount = 0
      if (currentClassInfo?.teacher) {
        teachersCount = 1
      }

      setStats({
        posts: postsCount || 0,
        teachers: teachersCount,
        classmates: Math.max((classmatesCount || 1) - 1, 0) // Subtract 1 to exclude the student themselves, minimum 0
      })

      // Log any errors for debugging
      if (postsError) console.error('Error fetching posts count:', postsError)
      if (classmatesError) console.error('Error fetching classmates count:', classmatesError)

    } catch (error) {
      console.error('Error fetching student stats:', error)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!student) return

    try {
      setUploadingAvatar(true)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${student.id}-${Date.now()}.${fileExt}`
      const filePath = `student-avatars/${fileName}`

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

      // Update student record
      const { error: updateError } = await supabase
        .from('students')
        .update({ avatar_url: publicUrl })
        .eq('id', student.id)

      if (updateError) {
        console.error('Error updating avatar in database:', updateError)
        toast.error('Error updating avatar in database: ' + updateError.message)
        return
      }

      // Update local state
      setStudent(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
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
    if (!student) return

    try {
      const { error } = await supabase
        .from('students')
        .update({
          first_name: editForm.first_name,
          middle_name: editForm.middle_name,
          last_name: editForm.last_name,
          suffix: editForm.suffix,
          bio: editForm.bio,
          grade: editForm.grade,
          age: editForm.age ? parseInt(editForm.age) : null
        })
        .eq('id', student.id)

      if (error) {
        console.error('Error updating profile:', error)
        toast.error('Error updating profile')
        return
      }

      setStudent(prev => prev ? { ...prev, ...editForm, age: editForm.age ? parseInt(editForm.age) : null } : null)
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
              <p className="mt-2 text-gray-600">Loading student details...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!student) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Student not found</p>
            <Link href="/" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to Dashboard
            </Link>
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
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/parent/children" className="text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Student Profile
              </h1>
              <p className="text-gray-600 mt-2">
                View and manage your child's information
              </p>
            </div>
          </div>
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
                      {student.avatar_url ? (
                        <img 
                          src={student.avatar_url} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <GraduationCap className="w-16 h-16 text-gray-400" />
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
                        {formatFullName(student.first_name, student.last_name, student.middle_name, student.suffix)}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="grade">Grade</Label>
                    {editMode ? (
                      <Input
                        id="grade"
                        value={editForm.grade}
                        onChange={(e) => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                        className="mt-1"
                        placeholder="Enter grade level"
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{student.grade || 'Not specified'}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="age">Age</Label>
                    {editMode ? (
                      <Input
                        id="age"
                        type="number"
                        value={editForm.age}
                        onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value }))}
                        className="mt-1"
                        placeholder="Enter age"
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{student.age ? `${student.age} years old` : 'Not specified'}</p>
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
                        placeholder="Tell us about the student..."
                      />
                    ) : (
                      <p className="text-gray-600 mt-1">{student.bio || 'No bio provided'}</p>
                    )}
                  </div>

                  <div>
                    <Label>Member Since</Label>
                    <p className="text-gray-600 mt-1">
                      {student.created_at ? new Date(student.created_at).toLocaleDateString() : 'Unknown'}
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

          {/* Stats and Class Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.posts}</p>
                      <p className="text-sm text-gray-600">Posts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.classmates}</p>
                      <p className="text-sm text-gray-600">Classmates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.teachers}</p>
                      <p className="text-sm text-gray-600">Teachers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Class Information */}
            {classInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5" />
                    <span>Class Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Class Name</Label>
                      <p className="text-lg font-medium mt-1">{classInfo.name}</p>
                    </div>
                    
                    {classInfo.teacher && (
                      <div>
                        <Label>Teacher</Label>
                        <p className="text-lg font-medium mt-1">
                          {formatFullName(
                            classInfo.teacher.first_name || '',
                            classInfo.teacher.last_name || '',
                            classInfo.teacher.middle_name,
                            classInfo.teacher.suffix
                          ) || classInfo.teacher.name}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{classInfo.teacher.email}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Posts */}
            {posts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Recent Updates</span>
                  </CardTitle>
                  <CardDescription>
                    Recent posts about this student
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {posts.slice(0, 5).map((post) => (
                      <div key={post.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {post.teacher && (
                              <span className="text-sm text-purple-600 bg-purple-100 px-2">
                                {formatFullName(
                                  post.teacher.first_name || '',
                                  post.teacher.last_name || '',
                                  post.teacher.middle_name,
                                  post.teacher.suffix
                                ) || post.teacher.name}
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 whitespace-pre-wrap text-sm">{post.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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