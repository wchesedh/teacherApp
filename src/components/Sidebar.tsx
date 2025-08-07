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
  User,
  Calendar,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getDisplayName } from '@/lib/utils'

interface SidebarProps {
  className?: string
  isCollapsed?: boolean
  onClose?: () => void
  isMobile?: boolean
}

export default function Sidebar({ className, isCollapsed = false, onClose, isMobile = false }: SidebarProps) {
  const { user, signOut } = useAuth()
  const [expandedSections, setExpandedSections] = useState<string[]>(['dashboard', 'management', 'communication', 'children'])
  const [userProfile, setUserProfile] = useState<{
    avatar_url?: string
    first_name?: string
    middle_name?: string
    last_name?: string
    suffix?: string
  } | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

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
        { title: 'Academic Periods', href: '/teacher/academic-periods', icon: Calendar },
      ]
    },
    {
      section: 'communication',
      title: 'Communication',
      icon: MessageSquare,
      items: [
        { title: 'All Announcements', href: '/teacher/announcements', icon: MessageSquare },
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
    if (!isClient || !user?.role) {
      return []
    }
    
    switch (user.role) {
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

  const handleNavigation = (href: string) => {
    if (isMobile && onClose) {
      onClose()
    }
    window.location.href = href
  }

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64",
      isMobile && "w-64",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
              <span className="text-white font-bold text-sm tracking-wider">TW</span>
            </div>
            <div className={`transition-all duration-300 ease-in-out ${
              (!isCollapsed || isMobile) ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'
            }`}>
              <h2 className="font-semibold text-gray-900">TrackWise</h2>
              <p className="text-xs text-gray-500 capitalize">
                {isClient && user?.role ? `${user.role} Portal` : 'User Portal'}
              </p>
            </div>
          </div>
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className={`transition-all duration-300 ease-in-out ${
        (!isCollapsed || isMobile) ? 'opacity-100 max-h-32' : 'opacity-0 max-h-0 overflow-hidden'
      }`}>
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
                    {isClient ? getDisplayName(
                      userProfile?.first_name || user?.first_name, 
                      userProfile?.last_name || user?.last_name, 
                      userProfile?.middle_name || user?.middle_name, 
                      userProfile?.suffix || user?.suffix, 
                      user?.name
                    ) : 'Loading...'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {isClient && user?.email ? user.email : 'Loading...'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {!isClient ? (
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 bg-gray-200 animate-pulse rounded"></div>
          </div>
        ) : (
          navItems.map((item) => (
            <div key={item.section}>
              {item.items.length > 0 ? (
                <div>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-between h-10 px-3 transition-all duration-200 hover:bg-gray-100",
                      isCollapsed && !isMobile && "justify-center px-2"
                    )}
                    onClick={() => toggleSection(item.section)}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4 transition-transform duration-200" />
                      <span className={`text-sm font-medium transition-all duration-300 ${
                        (!isCollapsed || isMobile) ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                    <div className={`transition-all duration-300 ${
                      (!isCollapsed || isMobile) ? 'opacity-100' : 'opacity-0'
                    }`}>
                      {isExpanded(item.section) ? (
                        <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                      ) : (
                        <ChevronRight className="w-4 h-4 transition-transform duration-200" />
                      )}
                    </div>
                  </Button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    (!isCollapsed || isMobile) && isExpanded(item.section) 
                      ? 'max-h-96 opacity-100' 
                      : 'max-h-0 opacity-0'
                  }`}>
                    <div className="ml-6 mt-1 space-y-1">
                      {item.items.map((subItem) => (
                        <Button
                          key={subItem.href}
                          variant="ghost"
                          className="w-full justify-start h-8 px-3 text-sm transition-all duration-200 hover:bg-gray-100"
                          onClick={() => handleNavigation(subItem.href)}
                        >
                          <subItem.icon className="w-4 h-4 mr-2" />
                          {subItem.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-10 px-3 transition-all duration-200 hover:bg-gray-100",
                    isCollapsed && !isMobile && "justify-center px-2"
                  )}
                  onClick={() => handleNavigation(item.href || '/')}
                >
                  <item.icon className="w-4 h-4" />
                  <span className={`text-sm font-medium ml-3 transition-all duration-300 ${
                    (!isCollapsed || isMobile) ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'
                  }`}>
                    {item.title}
                  </span>
                </Button>
              )}
            </div>
          ))
        )}
      </nav>
    </div>
  )
} 