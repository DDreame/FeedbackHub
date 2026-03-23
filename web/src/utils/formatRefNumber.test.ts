import { describe, expect, it } from 'vitest'
import { formatRefNumber } from './formatRefNumber'

describe('formatRefNumber', () => {
  it('converts a UUID to FB-XXXXXX format', () => {
    const uuid = '0193a7b2-c3d4-7e8f-9a0b-1c2d3e4f5a6b'
    expect(formatRefNumber(uuid)).toBe('FB-A7B2C3')
  })

  it('returns uppercase hex segment', () => {
    const uuid = 'abcdef01-2345-6789-abcd-ef0123456789'
    expect(formatRefNumber(uuid)).toBe('FB-EF0123')
  })

  it('handles different UUIDs distinctly', () => {
    const uuid1 = '0193a7b2-c3d4-7e8f-9a0b-1c2d3e4f5a6b'
    const uuid2 = '0193ffff-1234-7e8f-9a0b-1c2d3e4f5a6b'
    expect(formatRefNumber(uuid1)).not.toBe(formatRefNumber(uuid2))
  })

  it('always starts with FB- prefix', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc'
    expect(formatRefNumber(uuid)).toMatch(/^FB-[0-9A-F]{6}$/)
  })
})
