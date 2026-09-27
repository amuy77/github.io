import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors'

const ALLOWED = new Set(['https://amuy77.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'])

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return { ...corsHeaders, 'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://amuy77.github.io', Vary: 'Origin' }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
}

export function jsonError(req: Request, status: number, code: string, message: string): Response {
  return json(req, status, { error: { code, message } })
}
