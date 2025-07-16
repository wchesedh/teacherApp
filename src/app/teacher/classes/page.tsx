'use client'

import Layout from '@/components/Layout'
import ClassManagement from '@/components/teacher/ClassManagement'

export default function ClassesPage() {
  return (
    <Layout>
      <div className="p-8">
        <ClassManagement />
      </div>
    </Layout>
  )
} 