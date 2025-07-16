'use client'

import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import TeacherDetails from '@/components/admin/TeacherDetails'

export default function TeacherDetailsPage() {
  const params = useParams()
  const teacherId = params.id as string

  return (
    <Layout>
      <div className="p-8">
        <TeacherDetails teacherId={teacherId} />
      </div>
    </Layout>
  )
} 