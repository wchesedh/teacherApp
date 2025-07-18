import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://werhgbdxhgwlutshyqzq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcmhnYmR4aGd3bHV0c2h5cXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MzA4MTAsImV4cCI6MjA2ODIwNjgxMH0.tYt5oOvYfFgjGA_7IdLj6Mfw94ZdmA7eyw1CDHgcIQ4'

// Debug logging for environment variables
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Key exists:', !!supabaseAnonKey)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// User roles
export type UserRole = 'admin' | 'teacher' | 'parent'

// Registration roles (parents cannot self-register)
export type RegistrationRole = 'admin' | 'teacher'

// Authentication types
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
}

// Database types based on your schema
export interface Teacher {
  id: string
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  email: string
  password: string
  role: 'teacher'
  created_at?: string
}

export interface Class {
  id: string
  name: string
  teacher_id: string
}

export interface Student {
  id: string
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  class_id: string | null
}

export interface Parent {
  id: string
  name: string
  first_name?: string
  middle_name?: string
  last_name?: string
  suffix?: string
  email: string | null
  password?: string
  role: 'parent'
}

export interface Post {
  id: string
  teacher_id: string | null
  content: string
  created_at: string
}

export interface StudentParent {
  student_id: string
  parent_id: string
}

export interface PostStudentTag {
  post_id: string
  student_id: string
}

// Authentication helpers
export async function signUp(email: string, password: string, name: string, role: UserRole) {
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
  return { data, error }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
} 