'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, AcademicPeriod } from '@/lib/supabase'

interface PeriodContextType {
  periods: AcademicPeriod[]
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
  loading: boolean
  refreshPeriods: () => void
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('active')
  const [loading, setLoading] = useState(true)

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
      } else {
        setPeriods(periodsData || [])
      }
    } catch (error) {
      console.error('Error fetching periods:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshPeriods = () => {
    fetchPeriods()
  }

  useEffect(() => {
    fetchPeriods()
  }, [])

  // Load selected period from localStorage on mount
  useEffect(() => {
    const savedPeriod = localStorage.getItem('selectedAcademicPeriod')
    if (savedPeriod) {
      setSelectedPeriod(savedPeriod)
    }
  }, [])

  // Save selected period to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('selectedAcademicPeriod', selectedPeriod)
  }, [selectedPeriod])

  return (
    <PeriodContext.Provider value={{
      periods,
      selectedPeriod,
      setSelectedPeriod,
      loading,
      refreshPeriods
    }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function usePeriod() {
  const context = useContext(PeriodContext)
  if (context === undefined) {
    throw new Error('usePeriod must be used within a PeriodProvider')
  }
  return context
} 