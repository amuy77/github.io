import type { FigureKind } from '@/features/home/shop3d/laraFigure'

/** キャラの名簿に載せる 1 人分。新しい友達は、ここに合わせた定義を 1 つ作って index.ts の名簿に足す */
export type CharacterId = 'lara' | 'luru'
/** resident: お店に住んでいる（LaRa）。friend: ときどき遊びに来る */
export type CharacterRole = 'resident' | 'friend'

/** 1 回のセリフ（吹き出しの並び。続けてしゃべる） */
export type Say = string[]

/**
 * 遊びに来る友達のセリフ。*Reply は LaRa の返し（標準語）。
 * どれも 1 つの吹き出しは 22 文字くらいまで
 */
export interface FriendLines {
  /** お店に来たとき */
  arrive: Say[]
  /** LaRa を「わっ！」と驚かせたとき */
  prank: Say[]
  prankReply: Say[]
  /** 自分がつまずいた・失敗したとき（いたずらのバチ） */
  oops: Say[]
  oopsReply: Say[]
  /** タップされたとき */
  tap: Say[]
  /** 遊んでいる間のひとりごと */
  idle: Say[]
  /** 帰るとき */
  leave: Say[]
  leaveReply: Say[]
}

export interface CharacterDef {
  id: CharacterId
  name: string
  /** 読み */
  kana: string
  role: CharacterRole
  /** 設定画面に出す短い紹介 */
  profile: string
  /** 2D の絵（背景を抜いた PNG） */
  image: string
  /** 紹介の 4 コマなど（あれば） */
  comic?: string
  /** 3D の体（laraFigure.ts のどの形で作るか） */
  figure: FigureKind
  /** 友達のセリフ（resident は voiceLines.ts / laraVoice.ts を使う） */
  lines?: FriendLines
}
