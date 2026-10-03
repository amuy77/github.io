import { BRAND_IMAGE } from '@/components/mascot/Mascot'
import type { CharacterDef } from './types'

/** お店に住んでいる LaRa。セリフは src/features/home/shop3d/voiceLines.ts、選び方は laraVoice.ts */
export const LARA: CharacterDef = {
  id: 'lara',
  name: 'LaRa',
  kana: 'ララ',
  role: 'resident',
  profile: 'お店に住んでいる猫の女の子。のんきでマイペース、食いしん坊でよく眠い。三日月の被り物と太陽のしっぽ。',
  image: BRAND_IMAGE,
  figure: 'lara',
}
