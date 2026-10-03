import type { CharacterDef } from '../types'
import { LURU_LINES } from './lines'

const BASE = import.meta.env.BASE_URL

/** LaRa の幼なじみ。宮崎のヤシの木がモチーフの雄猫（耳は無い）。いたずら大好きなヤンチャな男の子。絵は public/brand/luru*.{png,jpg} */
export const LURU: CharacterDef = {
  id: 'luru',
  name: 'LuRu',
  kana: 'ルル',
  role: 'friend',
  profile: 'LaRa の幼なじみ。宮崎のヤシの木がモチーフの男の子（耳は無いけど雄猫）。いたずら大好きなヤンチャ坊主で、宮崎弁で話す。最後はたいてい自分がひどい目にあう。',
  image: `${BASE}brand/luru.png`,
  comic: `${BASE}brand/luru-comic.jpg`,
  figure: 'luru',
  lines: LURU_LINES,
}
