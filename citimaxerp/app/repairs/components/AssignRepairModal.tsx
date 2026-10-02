"use client";

import { useState, useEffect } from "react";
import { assignRepairItems, type Repair, type RepairItem } from "@/lib/repairs";
import { fetchUsers, type UserData } from "@/lib/users";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  UserCheck,
  Loader2,
  Users,
  AlertTriangle,
  CheckCircle,
  Package,
  Wrench,
  Check,
  ChevronsUpDown
} from "lucide-react";

interface AssignRepairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  repair: Repair | null;
}

interface ItemAssignment {
  item_id: string;
  assigned_to: string;
  selected: boolean;
}

export function AssignRepairModal({
  open,
  onOpenChange,
  onSuccess,
  repair,
}: AssignRepairModalProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);
  const [defaultAssignee, setDefaultAssignee] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [defaultAssigneeSearchOpen, setDefaultAssigneeSearchOpen] = useState(false);
  const [itemAssigneeSearchOpen, setItemAssigneeSearchOpen] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  // Helper function to check if an item is assigned
  const isItemAssigned = (item: any) => {
    return item.assigned_to && (
      typeof item.assigned_to === 'object' || 
      typeof item.assigned_to === 'string'
    );
  };

  // Get unassigned repairable items (to prevent reassignment)
  const repairableItems = repair?.items?.filter(item => 
    item.is_repairable && !isItemAssigned(item)
  ) || [];

  useEffect(() => {
    if (open) {
      loadUsers();
      initializeAssignments();
    }
  }, [open, repair]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const usersData = await fetchUsers();
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const initializeAssignments = () => {
    if (!repair) return;
    
    const initialAssignments = repairableItems.map(item => ({
      item_id: item.id,
      assigned_to: "",
      selected: true, // Select all by default
    }));
    
    setAssignments(initialAssignments);
    setDefaultAssignee("");
  };

  const updateAssignment = (itemId: string, field: keyof ItemAssignment, value: any) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.item_id === itemId 
        ? { ...assignment, [field]: value }
        : assignment
    ));
  };

  const applyDefaultAssignee = () => {
    if (!defaultAssignee) return;
    
    setAssignments(prev => prev.map(assignment => 
      assignment.selected 
        ? { ...assignment, assigned_to: defaultAssignee }
        : assignment
    ));
  };

  const handleSubmit = async () => {
    if (!repair) return;

    // Validate that all selected items have assignees
    const selectedAssignments = assignments.filter(a => a.selected);
    if (selectedAssignments.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item to assign.",
        variant: "destructive",
      });
      return;
    }

    const invalidAssignments = selectedAssignments.filter(a => !a.assigned_to);
    if (invalidAssignments.length > 0) {
      toast({
        title: "Error",
        description: "Please assign all selected items to users.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        assignments: selectedAssignments.map(a => ({
          item_id: a.item_id,
          assigned_to: a.assigned_to,
        }))
      };

      await assignRepairItems(repair.id, payload);
      
      toast({
        title: "Success",
        description: `${selectedAssignments.length} repair item(s) assigned successfully.`,
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error assigning repair items:", error);
      toast({
        title: "Error",
        description: "Failed to assign repair items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canAssign = repair?.approval_status === "approved" && repairableItems.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <span>Assign Repair Items</span>
          </SheetTitle>
          <SheetDescription>
            {repair ? `Assign repairable items from repair ${repair.repair_number}` : "Assign repair items to users"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!canAssign ? (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    {repair?.approval_status !== "approved" 
                      ? "This repair must be approved before items can be assigned."
                      : "No repairable items available for assignment."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Default Assignee Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span>Quick Assignment</span>
                  </CardTitle>
                  <CardDescription>
                    Select a default user to assign to all selected items
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <Popover open={defaultAssigneeSearchOpen} onOpenChange={setDefaultAssigneeSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={defaultAssigneeSearchOpen}
                            className="w-full justify-between font-normal"
                            disabled={usersLoading}
                          >
                            {defaultAssignee
                              ? (() => {
                                  const user = users.find((u) => u.id === defaultAssignee);
                                  return user ? `${user.first_name} ${user.last_name}` : "Select default assignee";
                                })()
                              : "Select default assignee"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search users..." />
                            <CommandList>
                              <CommandEmpty>No user found.</CommandEmpty>
                              <CommandGroup>
                                {users.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={`${user.first_name} ${user.last_name} ${user.email}`}
                                    onSelect={() => {
                                      setDefaultAssignee(user.id);
                                      setDefaultAssigneeSearchOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", defaultAssignee === user.id ? "opacity-100" : "opacity-0")} />
                                    <div>
                                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                                      <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={applyDefaultAssignee}
                      disabled={!defaultAssignee}
                    >
                      Apply to Selected
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Item Assignments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Package className="h-5 w-5 text-green-600" />
                    <span>Repairable Items ({repairableItems.length})</span>
                  </CardTitle>
                  <CardDescription>
                    Select items and assign them to specific users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {repairableItems.length > 0 ? (
                    <div className="space-y-4">
                      {repairableItems.map((item, index) => {
                        const assignment = assignments.find(a => a.item_id === item.id);
                        if (!assignment) return null;

                        return (
                          <div key={item.id} className="border rounded-lg p-4 space-y-3">
                            {/* Item Header with Selection */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={assignment.selected}
                                  onCheckedChange={(checked) => 
                                    updateAssignment(item.id, "selected", checked)
                                  }
                                />
                                <div>
                                  <h5 className="font-medium text-gray-900">
                                    {item.product?.name || item.product_name || item.product_id}
                                  </h5>
                                  {(item.variant?.name || item.variant_name || item.product_variant) && (
                                    <p className="text-sm text-gray-600">
                                      Variant: {item.variant?.name || item.variant_name || item.product_variant}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  <Wrench className="h-3 w-3 mr-1" />
                                  Repairable
                                </Badge>
                                <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                              </div>
                            </div>

                            {/* Assignment Selection */}
                            {assignment.selected && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Assign to:</Label>
                                <Popover
                                  open={itemAssigneeSearchOpen[item.id] || false}
                                  onOpenChange={(isOpen) =>
                                    setItemAssigneeSearchOpen((prev) => ({ ...prev, [item.id]: isOpen }))
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={itemAssigneeSearchOpen[item.id] || false}
                                      className="w-full justify-between font-normal"
                                      disabled={usersLoading}
                                    >
                                      {assignment.assigned_to
                                        ? (() => {
                                            const user = users.find((u) => u.id === assignment.assigned_to);
                                            return user ? `${user.first_name} ${user.last_name}` : "Select user";
                                          })()
                                        : "Select user"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search users..." />
                                      <CommandList>
                                        <CommandEmpty>No user found.</CommandEmpty>
                                        <CommandGroup>
                                          {users.map((user) => (
                                            <CommandItem
                                              key={user.id}
                                              value={`${user.first_name} ${user.last_name} ${user.email}`}
                                              onSelect={() => {
                                                updateAssignment(item.id, "assigned_to", user.id);
                                                setItemAssigneeSearchOpen((prev) => ({ ...prev, [item.id]: false }));
                                              }}
                                            >
                                              <Check className={cn("mr-2 h-4 w-4", assignment.assigned_to === user.id ? "opacity-100" : "opacity-0")} />
                                              <div>
                                                <div className="font-medium">{user.first_name} {user.last_name}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}

                            {/* Item Details */}
                            <div className="text-sm text-gray-600 grid grid-cols-2 gap-2">
                              {item.product?.sku && (
                                <div>
                                  <span className="font-medium">SKU:</span> {item.product.sku}
                                </div>
                              )}
                              {item.unique_identifier && (
                                <div>
                                  <span className="font-medium">ID:</span> {item.unique_identifier}
                                </div>
                              )}
                            </div>

                            {item.notes && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-600">Notes:</span>
                                <p className="text-gray-700 bg-gray-50 p-2 rounded mt-1">{item.notes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No repairable items available for assignment</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <SheetFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canAssign && (
              <Button 
                onClick={handleSubmit} 
                disabled={loading || assignments.filter(a => a.selected).length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assign Items ({assignments.filter(a => a.selected).length})
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}