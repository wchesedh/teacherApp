'use client'

import Layout from '@/components/Layout'
import StudentManagement from '@/components/teacher/StudentManagement'

export default function StudentsPage() {
  return (
    <Layout>
      <div className="p-8">
        <StudentManagement />
      </div>
    </Layout>
  )
} 