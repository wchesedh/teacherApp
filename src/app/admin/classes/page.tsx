'use client'

import ClassManagement from '@/components/admin/ClassManagement'
import Layout from '@/components/Layout'

export default function AdminClassesPage() {
  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Class Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage classes and assign them to academic periods
          </p>
        </div>
        
        <ClassManagement />
      </div>
    </Layout>
  )
} 