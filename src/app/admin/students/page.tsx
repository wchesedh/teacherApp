'use client'

import Layout from '@/components/Layout'
import StudentManagement from '@/components/admin/StudentManagement'

export default function AdminStudentsPage() {
  return (
    <Layout>
      <div className="p-8">
        <StudentManagement />
      </div>
    </Layout>
  )
} 