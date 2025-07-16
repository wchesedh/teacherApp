'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import Layout from '@/components/Layout'

export default function ParentMessagesPage() {
  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Messages
          </h1>
          <p className="text-gray-600 mt-2">
            Direct communication with teachers
          </p>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Messages Coming Soon</h3>
              <p className="text-gray-600">
                Direct messaging functionality with teachers will be available in a future update.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
} 