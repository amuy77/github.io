import { describe, expect, it } from 'vitest'
import { isMapsDestination, isMapsPlacePage, isMapsShortLink, mapsUrlInHtml } from '../../../supabase/functions/_shared/mapsLink'

describe('link-preview: Google マップの短縮リンク', () => {
  it('knows the short links', () => {
    expect(isMapsShortLink(new URL('https://maps.app.goo.gl/zj1ttgAbC?g_st=ic'))).toBe(true)
    expect(isMapsShortLink(new URL('https://goo.gl/maps/abc'))).toBe(true)
    expect(isMapsShortLink(new URL('https://goo.gl/other'))).toBe(false)
    expect(isMapsShortLink(new URL('https://www.google.com/maps/place/x'))).toBe(false)
  })
  it('stops at a Google Maps page or the consent page, and nowhere else', () => {
    expect(isMapsDestination(new URL('https://www.google.com/maps/place/Cafe/@35,139,17z'))).toBe(true)
    expect(isMapsDestination(new URL('https://www.google.co.jp/maps?cid=1'))).toBe(true)
    expect(isMapsDestination(new URL('https://maps.google.com/?q=35.1,136.9'))).toBe(true)
    expect(isMapsDestination(new URL('https://consent.google.com/ml?continue=x'))).toBe(true)
    expect(isMapsDestination(new URL('https://www.google.com/search?q=cafe'))).toBe(false)
    expect(isMapsDestination(new URL('https://evil.example/maps/place/x'))).toBe(false)
    expect(isMapsDestination(new URL('https://evilgoogle.com/maps'))).toBe(false)
    expect(isMapsPlacePage(new URL('https://www.google.com/maps/place/Cafe/@35,139,17z'))).toBe(true)
    expect(isMapsPlacePage(new URL('https://www.google.com/maps?cid=1'))).toBe(false)
  })
  it('finds the Maps URL inside a JavaScript interstitial', () => {
    const html = '<html><script>var u="https:\\/\\/www.google.com\\/maps\\/place\\/%E3%83%91%E3%83%B3\\/@35.6,139.7,17z\\/data=!3d35.61!4d139.71?entry=tts\\u0026g_ep=x";location.replace(u)</script><a href="https://www.google.com/maps">Google マップ</a></html>'
    expect(mapsUrlInHtml(html)).toBe('https://www.google.com/maps/place/%E3%83%91%E3%83%B3/@35.6,139.7,17z/data=!3d35.61!4d139.71?entry=tts&g_ep=x')
    expect(mapsUrlInHtml('<a href="https://www.google.com/maps">x</a>')).toBe('https://www.google.com/maps')
    expect(mapsUrlInHtml('<p>nothing</p>')).toBeNull()
  })
})
