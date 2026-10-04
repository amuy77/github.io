import { getSupabase } from './client'
import type { Database } from './database.types'

type Fn = keyof Database['public']['Functions']
type Args<F extends Fn> = Database['public']['Functions'][F]['Args']
type Ret<F extends Fn> = Database['public']['Functions'][F]['Returns']

/** PostgREST が「その関数は無い」と返すときのコード。マイグレーションをまだ当てていない間はこれになる */
const NOT_FOUND = 'PGRST202'

/**
 * DB 関数（RPC）を呼ぶ。関数がまだ無ければ fallback（今までの複数回の書き込み）に戻るので、
 * マイグレーションを当てる前でもアプリは動く。それ以外の失敗はそのまま投げる
 */
export async function callRpc<F extends Fn>(name: F, args: Args<F>, fallback: () => Promise<Ret<F>>): Promise<Ret<F>> {
  const { data, error } = await getSupabase().rpc(name, args as never)
  if (!error) return data as Ret<F>
  if (error.code === NOT_FOUND) return fallback()
  throw error
}
