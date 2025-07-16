'use client'

import Layout from '@/components/Layout'
import TeacherManagement from '@/components/admin/TeacherManagement'

export default function TeachersPage() {
  return (
    <Layout>
      <div className="p-8">
        <TeacherManagement />
      </div>
    </Layout>
  )
} 