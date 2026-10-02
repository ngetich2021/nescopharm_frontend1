"use client";
import { useState } from "react";
import * as React from "react";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Search,
  Download,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  UserX,
  RotateCcw,
  ShieldAlert
} from "lucide-react";

interface UserData {
  id: string
  company_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  email_verified: boolean
  last_login_at: string | null
  role_id: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  terminated_at?: string | null
  termination_reason?: string | null
  password_setup_token: string | null
  password_setup_token_expires_at: string | null
  company: {
    id: string
    name: string
    description: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    website: string | null
    logo_url: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    is_first_time: boolean
    current_subscription_id: string | null
  }
  role: {
    id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    company_id: string
  } | null
}

interface UsersTableComponentProps {
  users: UserData[];
  loading: boolean;
  onViewUser: (user: UserData) => void;
  onEditUser: (user: UserData) => void;
  onDeleteUser: (user: UserData) => void;
  onAssignRole: (user: UserData) => void;
  onSoftDelete?: (user: UserData) => void;
  onTerminate?: (user: UserData) => void;
  onRestore?: (user: UserData) => void;
  search: string;
  onSearchChange: (search: string) => void;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  totalItems: number;
  onRefresh: () => void;
  onCreateNew: () => void;
}

export default function UsersTableComponent({
  users,
  loading,
  onViewUser,
  onEditUser,
  onDeleteUser,
  onAssignRole,
  onSoftDelete,
  onTerminate,
  onRestore,
  search,
  onSearchChange,
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  totalItems,
  onRefresh,
  onCreateNew,
}: UsersTableComponentProps) {
  const getStatusBadge = (user: UserData) => {
    if (user.terminated_at) return <Badge variant="destructive" className="bg-red-600 text-white">Terminated</Badge>
    if (user.deleted_at) return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Deleted</Badge>
    return user.is_active ? (
      <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>
    );
  };

  const getVerificationBadge = (emailVerified: boolean) => {
    return emailVerified ? (
      <Badge variant="default" className="bg-green-100 text-green-800">Verified</Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <Input
                className="pl-8 max-w-sm"
                placeholder="Search users..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNew}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Verification</TableHead>
                <TableHead className="font-semibold">Last Login</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span>Loading users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="text-gray-500">
                      <p className="font-semibold">No users found</p>
                      <p className="text-sm">Add your first user to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  return (
                    <TableRow 
                      key={user.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onViewUser(user)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">
                            {[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {user.email || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {user.role?.name || "No role assigned"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user)}
                      </TableCell>
                      <TableCell>
                        {getVerificationBadge(user.email_verified)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.last_login_at ? format(new Date(user.last_login_at), "MMM dd, yyyy") : "-"}
                          {user.last_login_at && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(user.last_login_at), "HH:mm")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.created_at ? format(new Date(user.created_at), "MMM dd, yyyy") : "-"}
                          {user.created_at && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(user.created_at), "HH:mm")}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <ActionsDropdown
                          user={user}
                          onView={() => onViewUser(user)}
                          onEdit={() => onEditUser(user)}
                          onDelete={() => onDeleteUser(user)}
                          onAssignRole={() => onAssignRole(user)}
                          onSoftDelete={onSoftDelete ? () => onSoftDelete(user) : undefined}
                          onTerminate={onTerminate ? () => onTerminate(user) : undefined}
                          onRestore={onRestore ? () => onRestore(user) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={(value) => {
                onRowsPerPageChange(Number(value));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={rowsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center justify-center text-sm font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages || 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="border-gray-200 hover:bg-[#E30040]/10 hover:text-[#E30040] hover:border-[#E30040]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
    </>
  );
}

function ActionsDropdown({ 
  user,
  onView,
  onEdit,
  onDelete,
  onAssignRole,
  onSoftDelete,
  onTerminate,
  onRestore
}: { 
  user: UserData;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignRole: () => void;
  onSoftDelete?: () => void;
  onTerminate?: () => void;
  onRestore?: () => void;
}) {
  const isDeleted = !!user.deleted_at
  const isTerminated = !!user.terminated_at
  const canEdit = !isDeleted
  const canDelete = !isDeleted

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" /> Edit User
          </DropdownMenuItem>
        )}
        {!isDeleted && (
          <DropdownMenuItem onClick={onAssignRole}>
            <Users className="h-4 w-4 mr-2" /> Assign Role
          </DropdownMenuItem>
        )}
        {!isDeleted && canDelete && onSoftDelete && (
          <DropdownMenuItem onClick={onSoftDelete}>
            <UserX className="h-4 w-4 mr-2" /> Soft Delete
          </DropdownMenuItem>
        )}
        {!isDeleted && canDelete && onTerminate && (
          <DropdownMenuItem onClick={onTerminate} className="text-orange-600 focus:text-orange-600">
            <ShieldAlert className="h-4 w-4 mr-2" /> Terminate Account
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete User
            </DropdownMenuItem>
          </>
        )}
        {isDeleted && onRestore && (
          <DropdownMenuItem onClick={onRestore} className="text-green-600 focus:text-green-600">
            <RotateCcw className="h-4 w-4 mr-2" /> Restore
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}