/** はじめての案内を見たかどうか（端末に覚える） */
const KEY = 'lara.onboarded'

export function onboardingDone(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
export function markOnboarded() {
  try { localStorage.setItem(KEY, '1') } catch { /* 次も出るだけ */ }
}
export function resetOnboarding() {
  try { localStorage.removeItem(KEY) } catch { /* 見られなくても使える */ }
}
