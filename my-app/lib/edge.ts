import { getSupabaseBrowserClient } from "@/lib/client"

/**
 * Invokes a Supabase edge function and always returns its JSON body. supabase-js reports
 * non-2xx responses as a generic error, which hides messages such as "Select at least one
 * section"; the body is read from the error's Response instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeEdgeFunction(name: string, body: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.functions.invoke(name, { method: "POST", body })
  if (!error) return { data, error: null }

  const context = (error as { context?: Response }).context
  if (context && typeof context.json === "function") {
    try {
      const payload = await context.json()
      return { data: payload, error: payload?.error || payload?.message || error.message }
    } catch {
      // body was not JSON
    }
  }
  return { data: null, error: error.message || `Edge function ${name} failed` }
}
