import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'

// We need to test getReporterIdentity indirectly through the exported functions.
// Since getReporterIdentity is not exported, we test its behavior via createThread's
// reporter_id and the localStorage side effects.

const STORAGE_KEY = 'feedback_reporter_id'

describe('Reporter Identity (localStorage UUID)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('generates a UUID and stores it in localStorage on first access', async () => {
    // Clear any existing identity
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    // Import the module fresh — getReporterIdentity is called internally
    // We spy on fetch to intercept the call and inspect the reporter_id
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'thread-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { createThread } = await import('./api')
    await createThread('遇到问题', 'test summary', undefined, {
      current_route: '/test',
    })

    // localStorage should now have a UUID
    const storedId = localStorage.getItem(STORAGE_KEY)
    expect(storedId).toBeTruthy()
    expect(storedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )

    // The fetch call should have used the same ID in the body
    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(callBody.reporter_id).toBe(storedId)

    // The X-Reporter-Id header should match
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['X-Reporter-Id']).toBe(storedId)

    fetchSpy.mockRestore()
  })

  it('reuses the same UUID from localStorage on subsequent calls', async () => {
    // Pre-set a known UUID
    const existingId = '12345678-1234-1234-1234-123456789abc'
    localStorage.setItem(STORAGE_KEY, existingId)

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'thread-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { createThread } = await import('./api')
    await createThread('想提建议', 'another test', undefined, {
      current_route: '/test',
    })

    // Should reuse the existing ID, not generate a new one
    expect(localStorage.getItem(STORAGE_KEY)).toBe(existingId)

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(callBody.reporter_id).toBe(existingId)

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['X-Reporter-Id']).toBe(existingId)

    fetchSpy.mockRestore()
  })
})
