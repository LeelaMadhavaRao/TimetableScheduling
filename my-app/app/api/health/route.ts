import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/server"

export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {}

  try {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase.from("sections").select("id").limit(1)

    if (error) {
      checks.db = { status: "unhealthy", message: error.message }
    } else {
      checks.db = { status: "healthy" }
    }
  } catch (err) {
    checks.db = { status: "unhealthy", message: String(err) }
  }

  try {
    const solverUrl = process.env.ILP_SOLVER_URL || "http://localhost:8000"
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${solverUrl}/`, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      checks.solver = { status: "healthy", message: solverUrl }
    } else {
      checks.solver = { status: "unhealthy", message: `HTTP ${res.status}` }
    }
  } catch {
    checks.solver = { status: "unavailable", message: "Solver not reachable" }
  }

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      checks.email = { status: "configured" }
    } else {
      checks.email = { status: "unconfigured" }
    }
  } catch {
    checks.email = { status: "unknown" }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy" || c.status === "configured")

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
