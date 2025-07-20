'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart
} from 'recharts'
import {
  PackageIcon, TrendingUpIcon, UsersIcon, AlertTriangleIcon,
  CalendarIcon, ActivityIcon
} from 'lucide-react'

interface User {
  id: string
  username: string
  email: string
  role: string
  permissions: string[]
}

interface DashboardData {
  recentActivity: Array<{
    id: string
    action: string
    tableName: string
    recordId: string
    oldValues: Record<string, unknown> | null
    newValues: Record<string, unknown> | null
    timestamp: string
    user: {
      username: string
      role: string
    }
  }>
  lowStockAlerts: Array<{
    id: string
    material_name: string
    size: string
    material_type: string
    brand_name: string
    total_quantity: number
  }>
  expiringSoonAlerts: Array<{
    id: string
    material_name: string
    size: string
    material_type: string
    brand_name: string
    quantity: number
    expirationDate: string
    lotNumber: string
    vendor_name: string
  }>
  summaryStats: {
    total_materials: number
    active_batches: number
    total_vendors: number
    usage_last_30_days: number
    total_documents: number
    low_stock_materials: number
    expiring_soon_count: number
  }
  inventoryByCategory: Array<{
    material_type: string
    total_materials: number
    total_stock: number
  }>
  topUsedMaterials: Array<{
    material_name: string
    material_type: string
    brand_name: string
    total_used: number
  }>
  monthlyUsageTrends: Array<{
    month: string
    procedure_count: number
    total_quantity: number
  }>
  expiryPatterns: Array<{
    month: string
    materials_expiring: number
    total_quantity_expiring: number
  }>
  advanceMaterialsUsed: Array<{
    id: string
    material_name: string
    brand_name: string
    material_type: string
    total_used: number
  }>
}

// Tooltip style for dark background
const tooltipStyle = {
  backgroundColor: '#1a1a1a',
  color: '#fff',
  border: '1px solid #333',
  borderRadius: '8px',
  fontSize: '14px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
};
const tooltipItemStyle = {
  color: '#fff',
};

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data
        const userResponse = await fetch('/api/auth/me')
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user data')
        }
        const userData = await userResponse.json()
        setUser(userData.user)

        // Fetch dashboard data
        const dashboardResponse = await fetch('/api/dashboard')
        if (!dashboardResponse.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        const dashboardData = await dashboardResponse.json()
        setDashboardData(dashboardData)
      } catch (error) {
        console.error('Error fetching data:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
        if (error instanceof Error && error.message.includes('user data')) {
          router.push('/login')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const getExpiryColor = (days: number) => {
    if (days <= 7) return 'text-red-600'
    if (days <= 14) return 'text-orange-600'
    return 'text-yellow-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Here&apos;s what&apos;s happening with your inventory today.
          </p>
        </div>

        {/* Summary Statistics */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
                <PackageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.summaryStats.total_materials)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active inventory items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.summaryStats.active_batches)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Batches with stock
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usage (30 days)</CardTitle>
                <ActivityIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.summaryStats.usage_last_30_days)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recent procedures
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.summaryStats.total_vendors)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active suppliers
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts and Activity Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Advance Materials Used */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="h-5 w-5 text-blue-600" />
                Advance Materials Used
                <Badge variant="secondary" className="ml-auto">
                  {dashboardData?.advanceMaterialsUsed?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData?.advanceMaterialsUsed && dashboardData.advanceMaterialsUsed.length > 0 ? (
                  dashboardData.advanceMaterialsUsed.slice(0, 4).map((mat) => (
                    <div key={mat.id} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {mat.material_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {mat.brand_name} • {mat.material_type}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-blue-700 border-blue-300">
                        {mat.total_used} used
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No advance materials used in the last 30 days.
                  </p>
                )}
                {dashboardData?.advanceMaterialsUsed && dashboardData.advanceMaterialsUsed.length > 4 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/usage?purchaseType=Advance')}>
                    View All ({dashboardData.advanceMaterialsUsed.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="h-5 w-5 text-yellow-600" />
                Low Stock Alerts
                <Badge variant="secondary" className="ml-auto">
                  {dashboardData?.lowStockAlerts.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData?.lowStockAlerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {alert.material_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.brand_name} • {alert.material_type}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                      {alert.total_quantity} left
                    </Badge>
                  </div>
                ))}
                {dashboardData?.lowStockAlerts.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No low stock alerts
                  </p>
                )}
                {dashboardData && dashboardData.lowStockAlerts.length > 4 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/inventory?stockStatus=Low Stock')}>
                    View All ({dashboardData.lowStockAlerts.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expiring Soon Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-red-600" />
                Expiring Soon
                <Badge variant="secondary" className="ml-auto">
                  {dashboardData?.expiringSoonAlerts.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData?.expiringSoonAlerts.slice(0, 4).map((alert) => {
                  let daysUntilExpiry = '-';
                  let d: Date | null = null;
                  if (alert.expirationDate) {
                    // Debug log
                    console.log('Expiration date value:', alert.expirationDate);
                    if (typeof alert.expirationDate === 'string') {
                      // Try ISO, DD-MM-YYYY, MM/DD/YYYY
                      d = new Date(alert.expirationDate);
                      if (isNaN(d.getTime())) {
                        const dashParts = alert.expirationDate.split('-');
                        if (dashParts.length === 3) {
                          d = new Date(`${dashParts[2]}-${dashParts[1]}-${dashParts[0]}`);
                        }
                      }
                      if (d && isNaN(d.getTime())) {
                        const slashParts = alert.expirationDate.split('/');
                        if (slashParts.length === 3) {
                          d = new Date(`${slashParts[2]}-${slashParts[0].padStart(2, '0')}-${slashParts[1].padStart(2, '0')}`);
                        }
                      }
                    } else if (typeof alert.expirationDate === 'number') {
                      // Unix timestamp (ms)
                      d = new Date(alert.expirationDate);
                    } else if (typeof alert.expirationDate === 'object' && alert.expirationDate !== null) {
                      // Firestore/Prisma style: { seconds, nanoseconds }
                      const expDate = alert.expirationDate as { seconds?: number; nanoseconds?: number };
                      if ('seconds' in expDate && expDate.seconds) {
                        d = new Date(expDate.seconds * 1000);
                      }
                    }
                    if (d && !isNaN(d.getTime())) {
                      const today = new Date();
                      daysUntilExpiry = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)).toString();
                    } else {
                      daysUntilExpiry = 'N/A';
                    }
                  } else {
                    daysUntilExpiry = 'N/A';
                  }
                  return (
                    <div key={alert.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {alert.material_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {alert.brand_name} • Lot: {alert.lotNumber}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${getExpiryColor(Number(daysUntilExpiry))} border-red-300`}>
                        {isNaN(Number(daysUntilExpiry)) ? 'N/A' : daysUntilExpiry + 'd'}
                      </Badge>
                    </div>
                  )
                })}
                {dashboardData?.expiringSoonAlerts.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No expiring items
                  </p>
                )}
                {dashboardData && dashboardData.expiringSoonAlerts.length > 4 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/inventory?stockStatus=Expiring Soon')}>
                    View All ({dashboardData.expiringSoonAlerts.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {/* Inventory by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="h-5 w-5" />
                Inventory by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData?.inventoryByCategory || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="material_type" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [formatNumber(value), 'Stock']} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                  <Bar dataKey="total_stock" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Procedure Trends (moved right, renamed) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ActivityIcon className="h-5 w-5" />
                Monthly Procedure Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardData?.monthlyUsageTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [formatNumber(value), 'Procedures']} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                  <Area type="monotone" dataKey="procedure_count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => router.push('/inventory')}
                >
                  <PackageIcon className="h-6 w-6" />
                  <span>View Inventory</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => router.push('/usage')}
                >
                  <ActivityIcon className="h-6 w-6" />
                  <span>Record Usage</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => router.push('/analytics')}
                >
                  <TrendingUpIcon className="h-6 w-6" />
                  <span>View Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 