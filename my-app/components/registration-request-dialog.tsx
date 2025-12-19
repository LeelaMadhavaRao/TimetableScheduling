"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserPlus, Loader2, CheckCircle2, Mail, Phone, Building, User, Lock, MessageSquare } from "lucide-react"
import { Card } from "@/components/ui/card"

export function RegistrationRequestDialog() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    institutionName: "",
    username: "",
    password: "",
    confirmPassword: "",
    message: ""
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setErrorMessage("")
  }

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setErrorMessage("Full name is required")
      return false
    }
    
    if (!formData.email.trim()) {
      setErrorMessage("Email is required")
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setErrorMessage("Invalid email format")
      return false
    }

    if (!formData.username.trim()) {
      setErrorMessage("Username is required")
      return false
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/
    if (!usernameRegex.test(formData.username)) {
      setErrorMessage("Username must be 3-50 alphanumeric characters or underscore")
      return false
    }

    if (!formData.password) {
      setErrorMessage("Password is required")
      return false
    }

    if (formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters")
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/registration-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone || null,
          institutionName: formData.institutionName || null,
          username: formData.username,
          password: formData.password,
          message: formData.message || null
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitSuccess(true)
        // Reset form after 3 seconds
        setTimeout(() => {
          setFormData({
            fullName: "",
            email: "",
            phone: "",
            institutionName: "",
            username: "",
            password: "",
            confirmPassword: "",
            message: ""
          })
          setSubmitSuccess(false)
          setOpen(false)
        }, 3000)
      } else {
        setErrorMessage(data.message || "Failed to submit request")
      }
    } catch (error) {
      console.error("Submit error:", error)
      setErrorMessage("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Request Admin Access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-purple-400" />
            Request Timetable Administrator Access
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Fill out the form below to request access as a Timetable Administrator. 
            A system administrator will review your request.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <Card className="p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-400" />
              <h3 className="text-xl font-bold text-white">Request Submitted Successfully!</h3>
              <p className="text-slate-300">
                Your registration request has been submitted. You will receive a notification once a system administrator reviews your request.
              </p>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="John Doe"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john.doe@institution.edu"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Phone (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-200 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone (Optional)
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 234 567 8900"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Institution Name (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="institutionName" className="text-slate-200 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Institution/College Name (Optional)
              </Label>
              <Input
                id="institutionName"
                name="institutionName"
                value={formData.institutionName}
                onChange={handleChange}
                placeholder="ABC University"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4" />
                Desired Username <span className="text-red-400">*</span>
              </Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="johndoe123"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400">3-50 characters, alphanumeric and underscore only</p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password <span className="text-red-400">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-400">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirm Password <span className="text-red-400">*</span>
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Message (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Additional Message (Optional)
              </Label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell us why you want to become a timetable administrator..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
