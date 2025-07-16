'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, AuthUser, UserRole } from '@/lib/supabase'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('Initial session:', session, error)
        
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || '',
            role: session.user.user_metadata?.role || 'parent'
          }
          console.log('Setting user from session:', authUser)
          setUser(authUser)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      }
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session)
        
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name || '',
            role: session.user.user_metadata?.role || 'parent'
          }
          console.log('Setting user from auth change:', authUser)
          setUser(authUser)
        } else {
          console.log('Clearing user')
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in for:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      console.log('Sign in result:', data, error)
      return { error }
    } catch (err) {
      console.error('Sign in error:', err)
      return { error: err }
    }
  }

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    try {
      console.log('Attempting sign up for:', email, role)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          }
        }
      })
      console.log('Sign up result:', data, error)
      
      if (error) {
        return { error }
      }

      // If signup successful, create the appropriate database record
      if (data.user) {
        try {
          if (role === 'teacher') {
            // Create teacher record
            const { error: teacherError } = await supabase
              .from('teachers')
              .insert([{
                id: data.user.id,
                name: name,
                email: email
              }])

            if (teacherError) {
              console.error('Error creating teacher record:', teacherError)
              return { error: teacherError }
            }
          }
          // Note: Admin users don't need a separate database record
          // Parents are created by teachers, not through self-registration
        } catch (dbError) {
          console.error('Database record creation error:', dbError)
          return { error: dbError }
        }
      }

      return { error: null }
    } catch (err) {
      console.error('Sign up error:', err)
      return { error: err }
    }
  }

  const signOut = async () => {
    try {
      console.log('Signing out')
      const { error } = await supabase.auth.signOut()
      console.log('Sign out result:', error)
      return { error }
    } catch (err) {
      console.error('Sign out error:', err)
      return { error: err }
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 