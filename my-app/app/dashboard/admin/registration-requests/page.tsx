"use client"

import { useEffect, useState } from "react"
import { useAuth, useRequireAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  UserPlus, 
  Check, 
  X, 
  Loader2, 
  Mail, 
  Phone, 
  Building, 
  User, 
  Calendar, 
  MessageSquare,
  RefreshCw,
  AlertCircle
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RegistrationRequest {
  id: string
  full_name: string
  email: string
  phone: string | null
  institution_name: string | null
  username: string
  message: string | null
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  reviewed_by_admin?: {
    username: string
    name: string
  } | null
}

export default function RegistrationRequestsPage() {
  const { isLoading: authLoading } = useAuth()
  const { isLoading: requireAuthLoading } = useRequireAuth(['admin'])
  
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<"pending" | "approved" | "rejected">("pending")
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const fetchRequests = async (status: string = "pending") => {
    setIsLoading(true)
    setErrorMessage("")
    
    try {
      const response = await fetch(`/api/registration-request?status=${status}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.requests || [])
      } else {
        setErrorMessage(data.message || "Failed to fetch requests")
      }
    } catch (error) {
      console.error("Fetch requests error:", error)
      setErrorMessage("Failed to load registration requests")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !requireAuthLoading) {
      fetchRequests(selectedTab)
    }
  }, [authLoading, requireAuthLoading, selectedTab])

  const handleApprove = async () => {
    if (!selectedRequest) return

    setIsProcessing(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/registration-request/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh the list
        await fetchRequests(selectedTab)
        setShowApproveDialog(false)
        setSelectedRequest(null)
      } else {
        setErrorMessage(data.message || "Failed to approve request")
      }
    } catch (error) {
      console.error("Approve error:", error)
      setErrorMessage("An error occurred while approving the request")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      setErrorMessage("Rejection reason is required")
      return
    }

    setIsProcessing(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/registration-request/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          rejectionReason: rejectionReason,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh the list
        await fetchRequests(selectedTab)
        setShowRejectDialog(false)
        setSelectedRequest(null)
        setRejectionReason("")
      } else {
        setErrorMessage(data.message || "Failed to reject request")
      }
    } catch (error) {
      console.error("Reject error:", error)
      setErrorMessage("An error occurred while rejecting the request")
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">Pending</Badge>
      case "approved":
        return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-300 border-red-500/50">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (authLoading || requireAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-purple-400" />
            Registration Requests
          </h1>
          <p className="text-slate-300">Review and manage timetable administrator registration requests</p>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="pending" className="data-[state=active]:bg-slate-700">
                Pending {requests.length > 0 && selectedTab === "pending" && `(${requests.length})`}
              </TabsTrigger>
              <TabsTrigger value="approved" className="data-[state=active]:bg-slate-700">
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="data-[state=active]:bg-slate-700">
                Rejected
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests(selectedTab)}
              className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <TabsContent value={selectedTab} className="space-y-4">
            {isLoading ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </CardContent>
              </Card>
            ) : errorMessage ? (
              <Card className="bg-red-500/20 border-red-500/50">
                <CardContent className="flex items-center gap-3 p-6">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <p className="text-red-300">{errorMessage}</p>
                </CardContent>
              </Card>
            ) : requests.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <UserPlus className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-xl font-semibold text-slate-400 mb-2">No {selectedTab} requests</h3>
                  <p className="text-slate-500">
                    {selectedTab === "pending" 
                      ? "No pending registration requests at the moment"
                      : `No ${selectedTab} registration requests found`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {requests.map((request) => (
                  <Card key={request.id} className="bg-slate-800/50 border-slate-700 backdrop-blur-xl hover:border-blue-500/50 transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-400" />
                            {request.full_name}
                          </CardTitle>
                          <CardDescription className="text-slate-400">
                            Username: <span className="text-slate-300 font-medium">{request.username}</span>
                          </CardDescription>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">{request.email}</span>
                        </div>

                        {request.phone && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span className="text-sm">{request.phone}</span>
                          </div>
                        )}

                        {request.institution_name && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Building className="w-4 h-4 text-slate-500" />
                            <span className="text-sm">{request.institution_name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-slate-300">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">{formatDate(request.created_at)}</span>
                        </div>
                      </div>

                      {request.message && (
                        <div className="p-3 bg-slate-900/50 rounded-md border border-slate-700">
                          <div className="flex items-start gap-2 mb-1">
                            <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5" />
                            <span className="text-sm font-medium text-slate-400">Message:</span>
                          </div>
                          <p className="text-sm text-slate-300 ml-6">{request.message}</p>
                        </div>
                      )}

                      {request.status === "rejected" && request.rejection_reason && (
                        <div className="p-3 bg-red-500/10 rounded-md border border-red-500/30">
                          <div className="flex items-start gap-2 mb-1">
                            <X className="w-4 h-4 text-red-400 mt-0.5" />
                            <span className="text-sm font-medium text-red-400">Rejection Reason:</span>
                          </div>
                          <p className="text-sm text-red-300 ml-6">{request.rejection_reason}</p>
                        </div>
                      )}

                      {request.reviewed_by_admin && (
                        <div className="text-sm text-slate-400">
                          Reviewed by: <span className="text-slate-300">{request.reviewed_by_admin.name}</span>
                          {request.reviewed_at && ` on ${formatDate(request.reviewed_at)}`}
                        </div>
                      )}

                      {request.status === "pending" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowApproveDialog(true)
                            }}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowRejectDialog(true)
                            }}
                            variant="outline"
                            className="flex-1 border-red-500/50 text-red-300 hover:bg-red-500/20"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Approve Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Check className="w-5 h-5 text-green-400" />
                Approve Registration Request
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Are you sure you want to approve this registration request?
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-3 py-4">
                <div className="p-3 bg-slate-800 rounded-md">
                  <p className="text-sm text-slate-400">Name:</p>
                  <p className="text-white font-medium">{selectedRequest.full_name}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-md">
                  <p className="text-sm text-slate-400">Email:</p>
                  <p className="text-white font-medium">{selectedRequest.email}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-md">
                  <p className="text-sm text-slate-400">Username:</p>
                  <p className="text-white font-medium">{selectedRequest.username}</p>
                </div>
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <p className="text-sm text-green-400">
                    This will create a new Timetable Administrator account with the provided credentials.
                  </p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveDialog(false)
                  setErrorMessage("")
                }}
                disabled={isProcessing}
                className="bg-slate-800 border-slate-700 text-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <X className="w-5 h-5 text-red-400" />
                Reject Registration Request
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Please provide a reason for rejecting this request.
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-3 py-4">
                <div className="p-3 bg-slate-800 rounded-md">
                  <p className="text-sm text-slate-400">Name:</p>
                  <p className="text-white font-medium">{selectedRequest.full_name}</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rejectionReason" className="text-slate-200">
                    Rejection Reason <span className="text-red-400">*</span>
                  </Label>
                  <textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please explain why this request is being rejected..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectionReason("")
                  setErrorMessage("")
                }}
                disabled={isProcessing}
                className="bg-slate-800 border-slate-700 text-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason.trim()}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
