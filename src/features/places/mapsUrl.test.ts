import { describe, expect, it } from 'vitest'
import { areaOf, isGoogleMapsUrl, mapsInfoFrom, parseMapsUrl, parseOgTitle } from './mapsUrl'

describe('isGoogleMapsUrl', () => {
  it('knows the share links and the full links', () => {
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/AbCdEf123?g_st=ic')).toBe(true)
    expect(isGoogleMapsUrl('https://goo.gl/maps/xyz')).toBe(true)
    expect(isGoogleMapsUrl('https://www.google.com/maps/place/Cafe/@35.6,139.7,17z')).toBe(true)
    expect(isGoogleMapsUrl('https://www.google.co.jp/maps?q=35.6,139.7')).toBe(true)
    expect(isGoogleMapsUrl('https://maps.google.com/?cid=123')).toBe(true)
  })
  it('says no to other links', () => {
    expect(isGoogleMapsUrl('https://www.google.com/search?q=cafe')).toBe(false)
    expect(isGoogleMapsUrl('https://tabelog.com/tokyo/A1301/')).toBe(false)
    expect(isGoogleMapsUrl('not a url')).toBe(false)
    expect(isGoogleMapsUrl('https://evilgoogle.com/maps')).toBe(false)
  })
})

describe('parseMapsUrl', () => {
  it('reads the name from /maps/place/ and prefers the pin (!3d!4d) over the screen centre (@)', () => {
    const r = parseMapsUrl('https://www.google.com/maps/place/%E3%82%B3%E3%83%BC%E3%83%92%E3%83%BC%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%89+Y/@35.6600000,139.7000000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.6612345!4d139.7012345')
    expect(r.name).toBe('コーヒースタンド Y')
    expect(r.lat).toBeCloseTo(35.6612345)
    expect(r.lng).toBeCloseTo(139.7012345)
  })
  it('falls back to @lat,lng', () => {
    const r = parseMapsUrl('https://www.google.com/maps/place/Bistro/@34.7,135.5,16z')
    expect(r).toMatchObject({ name: 'Bistro', lat: 34.7, lng: 135.5 })
  })
  it('reads ?q= with coordinates, or a name and address', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=35.1,136.9')).toMatchObject({ lat: 35.1, lng: 136.9 })
    expect(parseMapsUrl('https://maps.google.com/?q=35.1,136.9').name).toBeUndefined()
    expect(parseMapsUrl('https://www.google.com/maps?q=%E3%83%91%E3%83%B3%E5%B1%8B+A,+%E6%9D%B1%E4%BA%AC%E9%83%BD%E6%B8%8B%E8%B0%B7%E5%8C%BA%E7%A5%9E%E5%AE%AE%E5%89%8D1-1'))
      .toMatchObject({ name: 'パン屋 A', address: '東京都渋谷区神宮前1-1', area: '渋谷区' })
    expect(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=place_id:ChIJ123').name).toBeUndefined()
  })
  it('unwraps the consent page', () => {
    const inner = 'https://www.google.com/maps/place/Cafe+Z/@35.0,135.7,17z/data=!3d35.01!4d135.76'
    const r = parseMapsUrl(`https://consent.google.com/ml?continue=${encodeURIComponent(inner)}&gl=DE`)
    expect(r).toMatchObject({ name: 'Cafe Z', lat: 35.01, lng: 135.76 })
    expect(r.mapsUrl).toContain('www.google.com/maps/place/')
  })
  it('gives nothing it cannot read', () => {
    expect(parseMapsUrl('https://maps.app.goo.gl/AbCdEf')).toEqual({ mapsUrl: 'https://maps.app.goo.gl/AbCdEf' })
    expect(parseMapsUrl('hello')).toEqual({})
    expect(parseMapsUrl('https://www.google.com/maps/@999,999,17z').lat).toBeUndefined()
  })
})

describe('parseOgTitle', () => {
  it('splits 「店名 · 住所」', () => {
    expect(parseOgTitle('トラットリア K · 〒248-0006 神奈川県鎌倉市小町1-2-3')).toEqual({ name: 'トラットリア K', address: '〒248-0006 神奈川県鎌倉市小町1-2-3' })
    expect(parseOgTitle('Google マップ')).toEqual({})
    expect(parseOgTitle(undefined)).toEqual({})
  })
})

describe('areaOf', () => {
  it('picks the ward or city', () => {
    expect(areaOf('〒150-0001 東京都渋谷区神宮前1-2-3')).toBe('渋谷区')
    expect(areaOf('日本、〒248-0006 神奈川県鎌倉市小町1-2-3')).toBe('鎌倉市')
    expect(areaOf('神奈川県横浜市中区山下町1')).toBe('横浜市中区')
    expect(areaOf('北海道虻田郡ニセコ町ニセコ1')).toBe('ニセコ町')
    expect(areaOf('渋谷区神宮前1-2-3')).toBe('渋谷区')
    expect(areaOf('1-2-3 Jingumae, Shibuya City, Tokyo')).toBe('')
  })
})

describe('mapsInfoFrom', () => {
  it('fills from the followed URL first, then the pasted link, then og:title', () => {
    const r = mapsInfoFrom('https://maps.app.goo.gl/AbC', {
      final_url: 'https://www.google.com/maps/place/Cafe+Z/@35.0,135.7,17z/data=!3d35.01!4d135.76',
      title: 'カフェ Z · 〒604-0000 京都府京都市中京区1',
    })
    expect(r).toMatchObject({ name: 'Cafe Z', lat: 35.01, lng: 135.76, address: '〒604-0000 京都府京都市中京区1', area: '京都市中京区' })
    expect(r.mapsUrl).toContain('/maps/place/Cafe+Z')
  })
  it('uses og:title when the URL had no name', () => {
    const r = mapsInfoFrom('https://maps.app.goo.gl/AbC', { final_url: 'https://www.google.com/maps?cid=123', title: 'パン屋 A · 東京都渋谷区神宮前1-1' })
    expect(r).toMatchObject({ name: 'パン屋 A', area: '渋谷区' })
    expect(r.lat).toBeUndefined()
  })
})
