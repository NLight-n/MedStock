'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, TrendingUpIcon, PackageIcon, UsersIcon, AlertTriangleIcon, BarChart3Icon } from 'lucide-react';

interface AnalyticsData {
  monthlyUsageByType: Array<{
    material_type: string;
    month: string;
    total_quantity: number;
  }>;
  monthlyUsageByMaterial: Array<{
    material_name: string;
    month: string;
    total_quantity: number;
  }>;
  vendorAnalysis: Array<{
    vendor_name: string;
    total_batches: number;
    current_stock: number;
    total_purchased: number;
    materials_supplied: number;
    advance_stock: number;
    purchased_stock: number;
  }>;
  advanceMaterialsByCategory: Array<{
    material_type: string;
    total_materials: number;
    advance_materials: number;
    advance_quantity: number;
    purchased_quantity: number;
  }>;
  topUsedMaterials: Array<{
    material_name: string;
    material_type: string;
    brand_name: string;
    total_used: number;
    usage_count: number;
  }>;
  currentStockStatus: Array<{
    material_type: string;
    total_materials: number;
    in_stock_materials: number;
    out_of_stock_materials: number;
    low_stock_materials: number;
    total_stock: number;
  }>;
  expiryAnalysis: Array<{
    material_type: string;
    expiring_soon: number;
    expiring_this_week: number;
    expired: number;
  }>;
  usageByPhysician: Array<{
    physician: string;
    procedure_count: number;
    total_quantity: number;
    unique_patients: number;
  }>;
  proceduresPerMonth: Array<{
    month: string;
    procedure_count: number;
  }>;
}

interface Filters {
  materialTypes: Array<{
    id: string;
    name: string;
  }>;
  materials: Array<{
    id: string;
    name: string;
    materialTypeId: string;
    brand: {
      id: string;
      name: string;
    };
  }>;
  vendors: Array<{
    id: string;
    name: string;
  }>;
  physicians: string[];
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMaterialType, setSelectedMaterialType] = useState('all');
  const [selectedMaterial, setSelectedMaterial] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedUsageType, setSelectedUsageType] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (selectedMaterialType && selectedMaterialType !== 'all') params.append('materialTypeId', selectedMaterialType);
      if (selectedMaterial && selectedMaterial !== 'all') params.append('materialId', selectedMaterial);
      if (selectedVendor && selectedVendor !== 'all') params.append('vendorId', selectedVendor);

      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      // Set empty data structure to prevent mapping errors
      setData({
        monthlyUsageByType: [],
        monthlyUsageByMaterial: [],
        vendorAnalysis: [],
        advanceMaterialsByCategory: [],
        topUsedMaterials: [],
        currentStockStatus: [],
        expiryAnalysis: [],
        usageByPhysician: [],
        proceduresPerMonth: []
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedMaterialType, selectedMaterial, selectedVendor]);

  useEffect(() => {
    fetchFilters();
    fetchData();
  }, [fetchData]);

  const fetchFilters = async () => {
    try {
      const response = await fetch('/api/analytics/filters');
      const filtersData = await response.json();
      setFilters(filtersData);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, m] = month.split('-');
    if (!year || !m) return month;
    const date = new Date(`${year}-${m}-01`);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  // Usage type options and selected data
  const usageTypeOptions = data?.monthlyUsageByType?.map(t => t.material_type) || [];
  // Default to first type if none selected
  const selectedType = selectedUsageType || usageTypeOptions[0] || null;
  const selectedTypeData = data?.monthlyUsageByType?.filter(t => t.material_type === selectedType) || [];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Comprehensive insights into your inventory and usage patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3Icon className="h-6 w-6 text-blue-600" />
          <span className="text-sm text-gray-500">Real-time Data</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5" />
            Filters & Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Material Type</Label>
              <Select value={selectedMaterialType} onValueChange={setSelectedMaterialType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {(filters?.materialTypes || []).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Specific Material</Label>
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="All Materials" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  {(filters?.materials || [])
                    .filter(material => !selectedMaterialType || selectedMaterialType === 'all' || material.materialTypeId === selectedMaterialType)
                    .map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} ({material.brand.name})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <Label>Vendor</Label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {(filters?.vendors || []).map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={fetchData} className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Apply Filters
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSelectedMaterialType('all');
                setSelectedMaterial('all');
                setSelectedVendor('all');
                fetchData();
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Monthly Usage Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUpIcon className="h-5 w-5" />
                  Monthly Usage Trends by Material Type
                </CardTitle>
                <CardDescription>Usage patterns over time by material category</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Material Type Selector */}
                <div className="mb-4">
                  <Select value={selectedType || ''} onValueChange={setSelectedUsageType}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select Material Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {usageTypeOptions.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={selectedTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={formatMonth}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={formatMonth}
                      formatter={(value: number) => [formatNumber(value), 'Quantity']}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total_quantity" 
                      stroke="#0088FE" 
                      strokeWidth={2}
                      name="Quantity Used"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Material-Specific Usage or Top Used Materials */}
            {selectedMaterial && selectedMaterial !== 'all' && data.monthlyUsageByMaterial && data.monthlyUsageByMaterial.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUpIcon className="h-5 w-5" />
                    Material-Specific Usage Trends
                  </CardTitle>
                  <CardDescription>Monthly usage for selected material</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.monthlyUsageByMaterial}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={formatDate}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={formatDate}
                        formatter={(value: number) => [formatNumber(value), 'Quantity']}
                        contentStyle={tooltipStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="total_quantity" 
                        stroke="#FF6B6B" 
                        strokeWidth={2}
                        name="Quantity Used"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PackageIcon className="h-5 w-5" />
                    Top Used Materials
                  </CardTitle>
                  <CardDescription>Most frequently used materials</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.topUsedMaterials || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="material_name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [formatNumber(value), 'Quantity']}
                        contentStyle={tooltipStyle}
                        itemStyle={tooltipItemStyle}
                      />
                      <Bar dataKey="total_used" fill="#00C49F" name="Total Used" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Procedures Per Month */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="h-5 w-5" />
                Number of Procedures Per Month
              </CardTitle>
              <CardDescription>How many procedures were recorded each month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.proceduresPerMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={formatMonth}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={formatMonth}
                    formatter={(value: number) => [formatNumber(value), 'Procedures']}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="procedure_count" 
                    stroke="#00C49F" 
                    strokeWidth={2}
                    name="Procedures"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vendor Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Vendor Performance Analysis
              </CardTitle>
              <CardDescription>Stock levels and purchasing patterns by vendor</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={data.vendorAnalysis || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vendor_name" angle={-45} textAnchor="end" height={100} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatNumber(value), 
                      name === 'current_stock' ? 'Current Stock' :
                      name === 'total_purchased' ? 'Total Purchased' :
                      name === 'advance_stock' ? 'Advance Stock' :
                      name === 'purchased_stock' ? 'Purchased Stock' : name
                    ]}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="current_stock" fill="#8884D8" name="Current Stock" />
                  <Bar yAxisId="left" dataKey="total_purchased" fill="#82CA9D" name="Total Purchased" />
                  <Line yAxisId="right" type="monotone" dataKey="materials_supplied" stroke="#FF6B6B" name="Materials Supplied" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vendor Efficiency Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Vendor Efficiency Metrics
              </CardTitle>
              <CardDescription>Vendor performance indicators and efficiency ratios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.vendorAnalysis || []).map((vendor) => {
                  const efficiency = vendor.total_purchased > 0 ? 
                    (vendor.current_stock / vendor.total_purchased * 100) : 0;
                  const advanceRatio = vendor.total_purchased > 0 ? 
                    (vendor.advance_stock / vendor.total_purchased * 100) : 0;
                  
                  return (
                    <div key={vendor.vendor_name} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        {vendor.vendor_name}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Materials Supplied:</span>
                          <span className="font-medium">{vendor.materials_supplied}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Batches:</span>
                          <span className="font-medium">{vendor.total_batches}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Current Stock:</span>
                          <span className="font-medium text-blue-600">{formatNumber(vendor.current_stock)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Purchased:</span>
                          <span className="font-medium text-green-600">{formatNumber(vendor.total_purchased)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Advance Stock:</span>
                          <span className="font-medium text-orange-600">{formatNumber(vendor.advance_stock)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stock Efficiency:</span>
                          <span className={`font-medium ${efficiency > 50 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {efficiency.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Advance Ratio:</span>
                          <span className="font-medium text-purple-600">{advanceRatio.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Stock Efficiency: {efficiency.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Advance vs Purchased Materials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="h-5 w-5" />
                  Advance vs Purchased by Category
                </CardTitle>
                <CardDescription>Distribution of advance and purchased materials</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.advanceMaterialsByCategory || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="material_type" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [formatNumber(value), 'Quantity']}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                    <Bar dataKey="advance_quantity" fill="#FFBB28" name="Advance" stackId="a" />
                    <Bar dataKey="purchased_quantity" fill="#FF8042" name="Purchased" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Current Stock Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-5 w-5" />
                  Current Stock Status by Category
                </CardTitle>
                <CardDescription>Stock levels and alerts by material type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.currentStockStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="material_type" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [formatNumber(value), 'Count']}
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend />
                    <Bar dataKey="in_stock_materials" fill="#00C49F" name="In Stock" />
                    <Bar dataKey="low_stock_materials" fill="#FFBB28" name="Low Stock" />
                    <Bar dataKey="out_of_stock_materials" fill="#FF6B6B" name="Out of Stock" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Advance Materials Detailed List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="h-5 w-5" />
                Advance Materials by Category - Detailed View
              </CardTitle>
              <CardDescription>Comprehensive breakdown of advance materials across all categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data.advanceMaterialsByCategory || []).map((category) => (
                  <div key={category.material_type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.material_type}
                      </h3>
                      <div className="flex gap-4 text-sm">
                        <span className="text-blue-600 font-medium">
                          Advance: {formatNumber(category.advance_quantity)}
                        </span>
                        <span className="text-orange-600 font-medium">
                          Purchased: {formatNumber(category.purchased_quantity)}
                        </span>
                        <span className="text-gray-600">
                          Total: {formatNumber(category.advance_quantity + category.purchased_quantity)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                        <div className="font-medium text-blue-800 dark:text-blue-200">Advance Materials</div>
                        <div className="text-2xl font-bold text-blue-600">{category.advance_materials}</div>
                        <div className="text-blue-600">Materials</div>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                        <div className="font-medium text-orange-800 dark:text-orange-200">Advance Stock</div>
                        <div className="text-2xl font-bold text-orange-600">{formatNumber(category.advance_quantity)}</div>
                        <div className="text-orange-600">Quantity</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        <div className="font-medium text-gray-800 dark:text-gray-200">Total Materials</div>
                        <div className="text-2xl font-bold text-gray-600">{category.total_materials}</div>
                        <div className="text-gray-600">In Category</div>
                      </div>
                    </div>
                    {category.advance_quantity > 0 && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ 
                              width: `${(category.advance_quantity / (category.advance_quantity + category.purchased_quantity)) * 100}%` 
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {((category.advance_quantity / (category.advance_quantity + category.purchased_quantity)) * 100).toFixed(1)}% Advance Stock
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expiry Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="h-5 w-5" />
                Expiry Analysis by Material Type
              </CardTitle>
              <CardDescription>Materials expiring soon by category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.expiryAnalysis || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="material_type" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [formatNumber(value), 'Materials']}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="expiring_soon" fill="#FFBB28" name="Expiring Soon (30 days)" />
                  <Bar dataKey="expiring_this_week" fill="#FF6B6B" name="Expiring This Week" />
                  <Bar dataKey="expired" fill="#FF0000" name="Expired" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Usage by Physician */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Usage by Physician
              </CardTitle>
              <CardDescription>Material usage patterns by physician</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.usageByPhysician || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="physician" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatNumber(value), 
                      name === 'total_quantity' ? 'Total Quantity' :
                      name === 'procedure_count' ? 'Procedures' :
                      name === 'unique_patients' ? 'Unique Patients' : name
                    ]}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend />
                  <Bar dataKey="total_quantity" fill="#0088FE" name="Total Quantity" />
                  <Bar dataKey="procedure_count" fill="#00C49F" name="Procedures" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
                <PackageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber((data.currentStockStatus || []).reduce((sum, item) => sum + Number(item.total_materials), 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all categories
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber((data.currentStockStatus || []).reduce((sum, item) => sum + Number(item.total_stock), 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current inventory
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber((data.vendorAnalysis || []).length)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Supplying materials
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber((data.expiryAnalysis || []).reduce((sum, item) => sum + Number(item.expiring_soon), 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Within 30 days
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
} 