'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Settings,
  ChevronDown,
  ChevronRight,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getDisplayName } from '@/lib/utils'

interface SidebarProps {
  className?: string
}

export default function Sidebar({ className }: SidebarProps) {
  const { user, signOut } = useAuth()
  const [expandedSections, setExpandedSections] = useState<string[]>(['dashboard'])
  const [userProfile, setUserProfile] = useState<{
    avatar_url?: string
    first_name?: string
    middle_name?: string
    last_name?: string
    suffix?: string
  } | null>(null)

  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])

  const fetchUserProfile = async () => {
    if (!user) return

    try {
      let profileData = null

      if (user.role === 'teacher') {
        const { data, error } = await supabase
          .from('teachers')
          .select('avatar_url, first_name, middle_name, last_name, suffix')
          .eq('id', user.id)
          .single()

        if (!error && data) {
          profileData = data
        }
      } else if (user.role === 'parent') {
        const { data, error } = await supabase
          .from('parents')
          .select('avatar_url, first_name, middle_name, last_name, suffix')
          .eq('id', user.id)
          .single()

        if (!error && data) {
          profileData = data
        }
      }

      setUserProfile(profileData)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const isExpanded = (section: string) => expandedSections.includes(section)



  const adminNavItems = [
    {
      section: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      href: '/',
      items: []
    },
    {
      section: 'management',
      title: 'Management',
      icon: Settings,
      items: [
        { title: 'Teachers', href: '/admin/teachers', icon: Users },
        { title: 'Classes', href: '/admin/classes', icon: BookOpen },
        { title: 'Parents', href: '/admin/parents', icon: Users },
        { title: 'Students', href: '/admin/students', icon: GraduationCap },
      ]
    },
    {
      section: 'communication',
      title: 'Communication',
      icon: MessageSquare,
      items: [
        { title: 'Posts', href: '/admin/posts', icon: MessageSquare },
        { title: 'Messages', href: '/admin/messages', icon: MessageSquare },
      ]
    }
  ]

  const teacherNavItems = [
    {
      section: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      href: '/',
      items: []
    },
    {
      section: 'profile',
      title: 'Profile',
      icon: User,
      href: '/teacher/profile',
      items: []
    },
    {
      section: 'management',
      title: 'Management',
      icon: Settings,
      items: [
        { title: 'My Classes', href: '/teacher/classes', icon: BookOpen },
        { title: 'Parents', href: '/teacher/parents', icon: Users },
        { title: 'Students', href: '/teacher/students', icon: GraduationCap },
      ]
    },
    {
      section: 'communication',
      title: 'Communication',
      icon: MessageSquare,
      items: [
        { title: 'All Announcements', href: '/teacher/announcements', icon: MessageSquare },
        { title: 'Create Post', href: '/teacher/posts/create', icon: MessageSquare },
        { title: 'My Posts', href: '/teacher/posts', icon: MessageSquare },
      ]
    }
  ]

  const parentNavItems = [
    {
      section: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      href: '/',
      items: []
    },
    {
      section: 'children',
      title: 'My Children',
      icon: GraduationCap,
      items: [
        { title: 'Children', href: '/parent/children', icon: GraduationCap },
        { title: 'Classes', href: '/parent/classes', icon: BookOpen },
      ]
    },
    {
      section: 'communication',
      title: 'Communication',
      icon: MessageSquare,
      items: [
        { title: 'Teacher Posts', href: '/parent/posts', icon: MessageSquare },
        { title: 'Messages', href: '/parent/messages', icon: MessageSquare },
      ]
    }
  ]

  const getNavItems = () => {
    switch (user?.role) {
      case 'admin':
        return adminNavItems
      case 'teacher':
        return teacherNavItems
      case 'parent':
        return parentNavItems
      default:
        return []
    }
  }

  const navItems = getNavItems()

  return (
    <div className={cn("w-64 bg-white border-r border-gray-200 h-screen flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">TrackWise</h2>
            <p className="text-xs text-gray-500 capitalize">{user?.role} Portal</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {userProfile?.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getDisplayName(
                    userProfile?.first_name || user?.first_name, 
                    userProfile?.last_name || user?.last_name, 
                    userProfile?.middle_name || user?.middle_name, 
                    userProfile?.suffix || user?.suffix, 
                    user?.name
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.section}>
            {item.items.length > 0 ? (
              <div>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-10 px-3"
                  onClick={() => toggleSection(item.section)}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </div>
                  {isExpanded(item.section) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                {isExpanded(item.section) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.items.map((subItem) => (
                      <Button
                        key={subItem.href}
                        variant="ghost"
                        className="w-full justify-start h-8 px-3 text-sm"
                        onClick={() => window.location.href = subItem.href}
                      >
                        <subItem.icon className="w-4 h-4 mr-2" />
                        {subItem.title}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start h-10 px-3"
                onClick={() => window.location.href = item.href || '/'}
              >
                <item.icon className="w-4 h-4 mr-3" />
                <span className="text-sm font-medium">{item.title}</span>
              </Button>
            )}
          </div>
        ))}
      </nav>


    </div>
  )
} 