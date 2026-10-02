"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, ChevronLeft, ChevronRight, PhoneCall, Users, ListTodo } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

interface CustomerOverviewProps {
  customerId: string
}

interface CustomerNote {
  id: string
  note_content: string
  created_at: string
  created_by: string
}

interface CustomerActivity {
  id: string
  customer_id: string
  activity_type: string
  title: string
  description: string
  start_time: string
  end_time?: string
  status: string
  location?: string
  additional_info?: any
  created_at: string
}

interface CustomerData {
  customer_notes: CustomerNote[]
  customer_activities: CustomerActivity[]
}

export function CustomerOverview({ customerId }: CustomerOverviewProps) {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const notesPerPage = 4

  const [activities, setActivities] = useState<any[]>([])
  const [activityPage, setActivityPage] = useState(1)
  const activitiesPerPage = 3
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [isActivitySheetOpen, setIsActivitySheetOpen] = useState(false)

  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [callDate, setCallDate] = useState("")
  const [callTime, setCallTime] = useState("")
  const [callDescription, setCallDescription] = useState("")

  useEffect(() => {
    // TODO: Replace with API calls for customer notes and activities
    // The provided API documentation does not include endpoints for these.
    // For now, these will be empty.
    setIsLoading(false)
    setCustomerData({ customer_notes: [], customer_activities: [] })
    setActivities([])
  }, [])

  async function addNote() {
    if (!newNote.trim()) return

    // TODO: Implement API call to add a customer note
    console.log("Add note functionality needs API endpoint:", newNote)
    setNewNote("")
    setIsModalOpen(false)
  }

  const handleScheduleCall = () => {
    // TODO: Implement call scheduling logic using API
    console.log("Scheduling call functionality needs API endpoint:", { callDate, callTime, callDescription })
    setIsCallModalOpen(false)
  }

  const getActivityTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "call":
        return "bg-blue-100 text-blue-800"
      case "meeting":
        return "bg-green-100 text-green-800"
      case "email":
        return "bg-yellow-100 text-yellow-800"
      case "task":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  const notes = customerData?.customer_notes || []

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="relative">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          {" "}
          {/* Note Dialog */}
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white"
            >
              <Plus className="h-5 w-5" />
              <span className="sr-only">Add note</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Note</DialogTitle>
              <DialogDescription>Create a new note for this customer. Click save when you're done.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="note" className="text-right">
                  Note
                </Label>
                <Textarea
                  id="note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={addNote}>
                Save note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CardHeader>
          <CardTitle>Customer Notes</CardTitle>
          <CardDescription>Important information about this customer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notes.slice((currentPage - 1) * notesPerPage, currentPage * notesPerPage).map((note) => (
              <div key={note.id} className="rounded-md bg-muted p-4">
                <p className="text-sm">{note.note_content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Added by User ID: {note.created_by} - {new Date(note.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
            {notes.length > notesPerPage && (
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {Math.ceil(notes.length / notesPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(notes.length / notesPerPage)))}
                  disabled={currentPage === Math.ceil(notes.length / notesPerPage)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
            {notes.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <ListTodo className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No notes yet</h3>
                <p className="text-sm text-gray-500 mb-4">Add your first note about this customer</p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="relative">
          <div className="absolute top-4 right-4 flex space-x-2">
            <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <PhoneCall className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Schedule a Call</DialogTitle>
                  <DialogDescription>Set up a call with the customer. Fill in the details below.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="call-date" className="text-right">
                      Date
                    </Label>
                    <Input
                      id="call-date"
                      type="date"
                      className="col-span-3"
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="call-time" className="text-right">
                      Time
                    </Label>
                    <Input
                      id="call-time"
                      type="time"
                      className="col-span-3"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="call-description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="call-description"
                      className="col-span-3"
                      value={callDescription}
                      onChange={(e) => setCallDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleScheduleCall}>
                    Schedule Call
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                /* TODO: Implement schedule meeting via API */
                console.log("Schedule meeting functionality needs API endpoint")
              }}
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                /* TODO: Implement create task via API */
                console.log("Create task functionality needs API endpoint")
              }}
            >
              <ListTodo className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle>Customer Activities</CardTitle>
          <CardDescription>Recent interactions and scheduled activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities
              .slice((activityPage - 1) * activitiesPerPage, activityPage * activitiesPerPage)
              .map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-md bg-muted p-4 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => {
                    setSelectedActivity(activity)
                    setIsActivitySheetOpen(true)
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-sm">{activity.description}</p>
                    </div>
                    <Badge variant="outline" className={getActivityTypeColor(activity.activity_type)}>
                      {activity.activity_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(activity.created_at).toLocaleString()} - {activity.location || "N/A"}
                  </p>
                </div>
              ))}
            {activities.length > activitiesPerPage && (
              <div className="flex justify-between items-center mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActivityPage((prev) => Math.max(prev - 1, 1))}
                  disabled={activityPage === 1}
                  aria-label="Previous page of activities"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm font-medium">
                  Page {activityPage} of {Math.ceil(activities.length / activitiesPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setActivityPage((prev) => Math.min(prev + 1, Math.ceil(activities.length / activitiesPerPage)))
                  }
                  disabled={activityPage === Math.ceil(activities.length / activitiesPerPage)}
                  aria-label="Next page of activities"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
            {activities.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <ListTodo className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activities yet</h3>
                <p className="text-sm text-gray-500 mb-4">Schedule your first activity with this customer</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setIsCallModalOpen(true)}>
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Schedule Call
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      /* TODO: Implement create task via API */
                      console.log("Create task functionality needs API endpoint")
                    }}
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Sheet open={isActivitySheetOpen} onOpenChange={setIsActivitySheetOpen}>
        {" "}
        {/* Updated Sheet */}
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedActivity?.title}</SheetTitle>
            <SheetDescription>{selectedActivity?.activity_type}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium">Description</h4>
              <p className="text-sm">{selectedActivity?.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium">Date and Time</h4>
              <p className="text-sm">
                {selectedActivity?.start_time && new Date(selectedActivity.start_time).toLocaleString()}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium">Location</h4>
              <p className="text-sm">{selectedActivity?.location || "N/A"}</p>
            </div>
            {selectedActivity?.activity_type === "task" &&
              selectedActivity.additional_info?.checklist &&
              Array.isArray(selectedActivity.additional_info.checklist) && (
                <div>
                  <h4 className="text-sm font-medium">Checklist</h4>
                  <ul className="list-disc list-inside">
                    {selectedActivity.additional_info.checklist.map((item: string, index: number) => (
                      <li key={index} className="text-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            <div>
              <h4 className="text-sm font-medium">Status</h4>
              <p className="text-sm">{selectedActivity?.status}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
