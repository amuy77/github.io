/** PostgREST は 1 回の応答を 1000 行で切る（max_rows）。ページを回して全部集める */
export const PAGE = 1000

interface Pageable<T> { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> }

/** `query` は `.range()` がまだ付いていないクエリ（order まで付けたもの）。順番を保ったまま全部返す */
export async function fetchAll<T>(query: Pageable<T>, page = PAGE): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await query.range(from, from + page - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < page) return out
  }
}
