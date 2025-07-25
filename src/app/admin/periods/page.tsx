'use client'

import AcademicPeriodManagement from '@/components/admin/AcademicPeriodManagement'
import Layout from '@/components/Layout'

export default function AdminPeriodsPage() {
  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Academic Periods
          </h1>
          <p className="text-gray-600 mt-2">
            Manage semesters, quarters, and other academic periods
          </p>
        </div>
        
        <AcademicPeriodManagement />
      </div>
    </Layout>
  )
} 