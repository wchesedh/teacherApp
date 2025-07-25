'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

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

interface ActivePeriodContextType {
  activePeriod: AcademicPeriod | null
  loading: boolean
  refreshActivePeriod: () => Promise<void>
  setActivePeriod: (period: AcademicPeriod | null) => void
}

const ActivePeriodContext = createContext<ActivePeriodContextType | undefined>(undefined)

export function ActivePeriodProvider({ children }: { children: ReactNode }) {
  const [activePeriod, setActivePeriod] = useState<AcademicPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivePeriod = async () => {
    try {
      setLoading(true)
      const { data: periodsData, error } = await supabase
        .from('academic_periods')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error fetching active period:', error)
        setActivePeriod(null)
      } else {
        setActivePeriod(periodsData)
      }
    } catch (error) {
      console.error('Error fetching active period:', error)
      setActivePeriod(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshActivePeriod = async () => {
    await fetchActivePeriod()
  }

  useEffect(() => {
    fetchActivePeriod()
  }, [])

  return (
    <ActivePeriodContext.Provider value={{
      activePeriod,
      loading,
      refreshActivePeriod,
      setActivePeriod
    }}>
      {children}
    </ActivePeriodContext.Provider>
  )
}

export function useActivePeriod() {
  const context = useContext(ActivePeriodContext)
  if (context === undefined) {
    throw new Error('useActivePeriod must be used within an ActivePeriodProvider')
  }
  return context
} 