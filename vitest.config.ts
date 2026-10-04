import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// 純粋なロジック（日付・連続記録・服・セリフ・レシピの読み取り・集計）の単体テスト。数秒で回る: `npm test`
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
