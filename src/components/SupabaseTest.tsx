'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<string>('Testing connection...')
  const [teachers, setTeachers] = useState<any[]>([])

  useEffect(() => {
    async function testConnection() {
      try {
        // Test the connection by fetching teachers
        const { data, error } = await supabase
          .from('teachers')
          .select('*')
          .limit(5)

        if (error) {
          setConnectionStatus(`Connection failed: ${error.message}`)
        } else {
          setConnectionStatus('✅ Connected to Supabase successfully!')
          setTeachers(data || [])
        }
      } catch (err) {
        setConnectionStatus(`Connection error: ${err}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Supabase Connection Test</h2>
      <p className="mb-4">{connectionStatus}</p>
      
      {teachers.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Teachers in database:</h3>
          <ul className="space-y-1">
            {teachers.map((teacher) => (
              <li key={teacher.id} className="text-sm">
                {teacher.name} ({teacher.email})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 