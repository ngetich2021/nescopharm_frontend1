'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FinanceTableSkeleton } from '@/components/ui/skeletons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/finance';

interface Budget {
  id: string;
  budget_name: string;
  budget_period: string;
  start_date: string;
  end_date: string;
  total_budgeted: number;
  total_actual: number;
  variance: number;
  variance_percentage: number;
  status: 'active' | 'completed' | 'draft';
  department?: string;
  created_at: string;
  updated_at: string;
  line_items?: BudgetLineItem[];
}

interface BudgetLineItem {
  id: string;
  account_id: string;
  account?: {
    account_code: string;
    account_name: string;
    account_type: string;
  };
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  category?: string;
  notes?: string;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    budget_name: '',
    budget_period: '',
    start_date: '',
    end_date: '',
    department: '',
    status: 'draft',
  });

  // Mock data for demonstration
  const mockBudgets: Budget[] = [
    {
      id: '1',
      budget_name: '2024 Annual Budget',
      budget_period: '2024',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      total_budgeted: 1000000,
      total_actual: 850000,
      variance: -150000,
      variance_percentage: -15,
      status: 'active',
      department: 'Operations',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z',
    },
    {
      id: '2',
      budget_name: 'Q3 Marketing Budget',
      budget_period: '2024-Q3',
      start_date: '2024-07-01',
      end_date: '2024-09-30',
      total_budgeted: 150000,
      total_actual: 120000,
      variance: -30000,
      variance_percentage: -20,
      status: 'active',
      department: 'Marketing',
      created_at: '2024-07-01T00:00:00Z',
      updated_at: '2024-07-15T00:00:00Z',
    },
    {
      id: '3',
      budget_name: 'Q4 IT Infrastructure',
      budget_period: '2024-Q4',
      start_date: '2024-10-01',
      end_date: '2024-12-31',
      total_budgeted: 200000,
      total_actual: 0,
      variance: 0,
      variance_percentage: 0,
      status: 'draft',
      department: 'IT',
      created_at: '2024-09-01T00:00:00Z',
      updated_at: '2024-09-01T00:00:00Z',
    },
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setBudgets(mockBudgets);
      setLoading(false);
    }, 1000);
  }, []);

  const handleCreateBudget = async () => {
    try {
      // Mock budget creation
      const newBudget: Budget = {
        id: Date.now().toString(),
        ...formData,
        total_budgeted: 0,
        total_actual: 0,
        variance: 0,
        variance_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Budget;

      setBudgets(prev => [...prev, newBudget]);
      
      toast({
        title: 'Success',
        description: 'Budget created successfully',
      });
      
      setShowCreateDialog(false);
      setFormData({
        budget_name: '',
        budget_period: '',
        start_date: '',
        end_date: '',
        department: '',
        status: 'draft',
      });
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to create budget',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit className="h-4 w-4" />;
      case 'active':
        return <Target className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Edit className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Target className="h-4 w-4 text-gray-600" />;
  };

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = searchTerm === '' || 
      budget.budget_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.budget_period.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || budget.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || budget.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const uniqueDepartments = [...new Set(budgets.map(budget => budget.department))].filter(Boolean);

  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.total_budgeted, 0);
  const totalActual = budgets.reduce((sum, budget) => sum + budget.total_actual, 0);
  const totalVariance = totalActual - totalBudgeted;
  const totalVariancePercentage = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

  if (loading) {
    return <FinanceTableSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-gray-600">Plan, track, and analyze your budgets</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
              <DialogDescription>
                Create a new budget for planning and tracking expenses
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="budget_name">Budget Name</Label>
                <Input
                  id="budget_name"
                  value={formData.budget_name}
                  onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
                  placeholder="e.g., 2024 Annual Budget"
                />
              </div>
              <div>
                <Label htmlFor="budget_period">Budget Period</Label>
                <Input
                  id="budget_period"
                  value={formData.budget_period}
                  onChange={(e) => setFormData({ ...formData, budget_period: e.target.value })}
                  placeholder="e.g., 2024, Q1-2024"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="department">Department (Optional)</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Marketing, Operations"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBudget} disabled={!formData.budget_name || !formData.start_date || !formData.end_date}>
                Create Budget
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
            {getVarianceIcon(totalVariance)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getVarianceColor(totalVariance)}`}>
              {formatCurrency(totalVariance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variance %</CardTitle>
            {getVarianceIcon(totalVariance)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getVarianceColor(totalVariance)}`}>
              {totalVariancePercentage.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search budgets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {uniqueDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Budgets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Budgets ({filteredBudgets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Budget Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Budgeted</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.map((budget) => {
                const progressPercentage = budget.total_budgeted > 0 
                  ? Math.min((budget.total_actual / budget.total_budgeted) * 100, 100)
                  : 0;
                
                return (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{budget.budget_name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(budget.start_date).toLocaleDateString()} - {new Date(budget.end_date).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{budget.budget_period}</TableCell>
                    <TableCell>{budget.department || '-'}</TableCell>
                    <TableCell>{formatCurrency(budget.total_budgeted)}</TableCell>
                    <TableCell>{formatCurrency(budget.total_actual)}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getVarianceColor(budget.variance)}`}>
                        {getVarianceIcon(budget.variance)}
                        <span>{formatCurrency(budget.variance)}</span>
                        <span className="text-sm">({budget.variance_percentage.toFixed(1)}%)</span>
                      </div>
                    </TableCell>
                    <TableCell className="w-32">
                      <div className="space-y-1">
                        <Progress value={progressPercentage} className="h-2" />
                        <div className="text-xs text-gray-500">
                          {progressPercentage.toFixed(1)}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(budget.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(budget.status)}
                          {budget.status}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedBudget(budget)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Budget
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-primary">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredBudgets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No budgets found. Create your first budget to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
