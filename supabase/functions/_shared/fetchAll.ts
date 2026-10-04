/** PostgREST は 1 回の応答を 1000 行で切る（max_rows）。ページを回して全部集める（Edge Function 用） */
interface Pageable<T> { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }
export async function fetchAll<T>(query: Pageable<T>, page = 1000): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await query.range(from, from + page - 1)
    if (error) return { data: out, error }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < page) return { data: out, error: null }
  }
}
