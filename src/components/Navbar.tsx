'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  User, 
  LogOut,
  Bell,
  Settings,
  MessageSquare,
  GraduationCap,
  Users,
  BookOpen
} from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Notification {
  id: string
  type: 'post' | 'student' | 'teacher' | 'parent' | 'system'
  title: string
  message: string
  created_at: string
  read: boolean
  link?: string
}

export default function Navbar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user) return

    try {
      setLoading(true)
      let notificationsData: Notification[] = []

      if (user.role === 'teacher') {
        // For teachers: show new posts from other teachers, new students in their classes
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            created_at,
            teachers!inner(name)
          `)
          .neq('teacher_id', user.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(10)

        if (!postsError && postsData) {
          postsData.forEach((post: any) => {
            notificationsData.push({
              id: `post-${post.id}`,
              type: 'post',
              title: 'New Post from Teacher',
              message: `${post.teachers.name}: ${post.content.substring(0, 50)}...`,
              created_at: post.created_at,
              read: false,
              link: `/teacher/posts`
            })
          })
        }

        // Check for new students in teacher's classes
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select(`
            id,
            name,
            created_at,
            classes!inner(name, teacher_id)
          `)
          .eq('classes.teacher_id', user.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        if (!studentsError && studentsData) {
          studentsData.forEach((student: any) => {
            notificationsData.push({
              id: `student-${student.id}`,
              type: 'student',
              title: 'New Student Added',
              message: `${student.name} was added to ${student.classes.name}`,
              created_at: student.created_at,
              read: false,
              link: `/teacher/students`
            })
          })
        }

      } else if (user.role === 'parent') {
        // For parents: show new posts about their children
        const { data: studentParentsData, error: studentParentsError } = await supabase
          .from('student_parent')
          .select('student_id')
          .eq('parent_id', user.id)

        if (!studentParentsError && studentParentsData) {
          const studentIds = studentParentsData.map(sp => sp.student_id)
          
          if (studentIds.length > 0) {
            const { data: postsData, error: postsError } = await supabase
              .from('post_student_tags')
              .select(`
                posts!inner(
                  id,
                  content,
                  created_at,
                  teachers!inner(name)
                )
              `)
              .in('student_id', studentIds)
              .gte('posts.created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order('posts.created_at', { ascending: false })

            if (!postsError && postsData) {
              postsData.forEach((item: any) => {
                notificationsData.push({
                  id: `post-${item.posts.id}`,
                  type: 'post',
                  title: 'Update About Your Child',
                  message: `${item.posts.teachers.name}: ${item.posts.content.substring(0, 50)}...`,
                  created_at: item.posts.created_at,
                  read: false,
                  link: `/parent/posts`
                })
              })
            }
          }
        }

      } else if (user.role === 'admin') {
        // For admins: show system notifications, new users
        const { data: teachersData, error: teachersError } = await supabase
          .from('teachers')
          .select('id, name, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        if (!teachersError && teachersData) {
          teachersData.forEach(teacher => {
            notificationsData.push({
              id: `teacher-${teacher.id}`,
              type: 'teacher',
              title: 'New Teacher Joined',
              message: `${teacher.name} joined the platform`,
              created_at: teacher.created_at,
              read: false,
              link: `/admin/teachers`
            })
          })
        }

        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id, name, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        if (!studentsError && studentsData) {
          studentsData.forEach(student => {
            notificationsData.push({
              id: `student-${student.id}`,
              type: 'student',
              title: 'New Student Added',
              message: `${student.name} was added to the system`,
              created_at: student.created_at,
              read: false,
              link: `/admin/students`
            })
          })
        }
      }

      // Sort by creation date (newest first)
      notificationsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      // Check read state from localStorage
      const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]')
      const notificationsWithReadState = notificationsData.map(notification => ({
        ...notification,
        read: readNotifications.includes(notification.id)
      }))
      
      setNotifications(notificationsWithReadState)

    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    )

    // Store read state in localStorage
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]')
    if (!readNotifications.includes(notification.id)) {
      readNotifications.push(notification.id)
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications))
    }

    // Navigate to the link if provided
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <MessageSquare className="w-4 h-4" />
      case 'student':
        return <GraduationCap className="w-4 h-4" />
      case 'teacher':
        return <Users className="w-4 h-4" />
      case 'parent':
        return <Users className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - App title */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Teacher-Parent Communication
          </h1>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>
                <div className="flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <div className={`mt-1 ${!notification.read ? 'text-blue-600' : 'text-gray-500'}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-blue-900' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button variant="ghost" size="sm">
            <Settings className="w-5 h-5" />
          </Button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
} 