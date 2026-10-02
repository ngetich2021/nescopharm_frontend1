'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Users, DollarSign, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/finance';
import { PayrollRecord, getPayrollRecords, getPayrollSummary, deletePayrollRecord } from '@/lib/payroll';
import { PayrollTable } from './PayrollTable';

interface PayrollSummary {
  total_payroll_records: number;
  total_employees: number;
  total_gross_pay: number | string;
  total_net_pay: number | string;
}

export function PayrollPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<PayrollRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: currentPage, per_page: rowsPerPage };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await getPayrollRecords(params);
      setPayrollRecords(res.payroll_records ?? []);
      setTotalPages(res.pagination?.last_page ?? 1);
      setTotalItems(res.pagination?.total ?? 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payroll records.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, statusFilter, searchTerm]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await getPayrollSummary();
      setSummary(res?.summary ?? null);
    } catch {
      // non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleViewPayroll = (payroll: PayrollRecord) => {
    router.push(`/hr/payroll/${payroll.id}`);
  };

  const handleEditPayroll = (payroll: PayrollRecord) => {
    router.push(`/hr/payroll/${payroll.id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deletePayrollRecord(deleteTarget.id);
      toast({ title: 'Deleted', description: `Payroll ${deleteTarget.payroll_number} deleted.` });
      setDeleteTarget(null);
      fetchRecords();
      fetchSummary();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete payroll record.', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payroll Management</h1>
        <p className="text-sm text-gray-600">Manage employee payroll records and payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" /> : (summary?.total_payroll_records ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Active payroll batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" /> : (summary?.total_employees ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">In payroll system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(parseFloat(String(summary?.total_gross_pay ?? 0)))}
            </div>
            <p className="text-xs text-muted-foreground">Total before deductions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Pay</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {summaryLoading ? <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" /> : formatCurrency(parseFloat(String(summary?.total_net_pay ?? 0)))}
            </div>
            <p className="text-xs text-muted-foreground">Final amount to employees</p>
          </CardContent>
        </Card>
      </div>

      <PayrollTable
        payrollRecords={payrollRecords}
        loading={loading}
        onViewPayroll={handleViewPayroll}
        onEditPayroll={handleEditPayroll}
        onDeletePayroll={(p) => {
          if (p.status !== 'draft') {
            toast({ title: 'Cannot delete', description: 'Only draft payroll records can be deleted.', variant: 'destructive' });
            return;
          }
          setDeleteTarget(p);
        }}
        search={searchTerm}
        onSearchChange={(s) => { setSearchTerm(s); setCurrentPage(1); }}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={(r) => { setRowsPerPage(r); setCurrentPage(1); }}
        totalItems={totalItems}
        onRefresh={() => { fetchRecords(); fetchSummary(); }}
        onCreateNew={() => router.push('/hr/payroll/bulk')}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payroll Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete payroll record <strong>{deleteTarget?.payroll_number}</strong>?
              This will also remove all associated payroll items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
