import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { FeedbackHistoryPage } from './FeedbackHistoryPage'

// vi.hoisted() is evaluated before vi.mock runs its factory
const mockListMyThreads = vi.hoisted(() => vi.fn())

vi.mock('../services/api', () => ({
  listMyThreads: mockListMyThreads,
  STATUS_LABELS: {
    received: '已收到',
    in_review: '处理中',
    waiting_for_user: '待补充信息',
    closed: '已关闭',
  },
}))

const mockThreads = [
  {
    id: 'thread-001',
    reporter_id: 'reporter-1',
    category: '遇到问题',
    status: 'in_review',
    summary: '应用经常崩溃',
    latest_public_message_at: '2026-03-21T10:00:00Z',
    created_at: '2026-03-21T09:00:00Z',
    updated_at: '2026-03-21T10:00:00Z',
    closed_at: null,
    context: {
      app_version: '1.0.0',
      os_name: 'iOS',
      os_version: '17.0',
      device_model: 'iPhone 15',
      current_route: '/feedback/thread-001',
      captured_at: '2026-03-21T09:00:00Z',
    },
  },
  {
    id: 'thread-002',
    reporter_id: 'reporter-1',
    category: '想提建议',
    status: 'received',
    summary: '希望增加暗色模式',
    latest_public_message_at: '2026-03-20T14:00:00Z',
    created_at: '2026-03-20T13:00:00Z',
    updated_at: '2026-03-20T14:00:00Z',
    closed_at: null,
    context: {
      app_version: '1.0.0',
      os_name: 'Android',
      os_version: '14',
      device_model: 'Pixel 8',
      current_route: '/feedback/thread-002',
      captured_at: '2026-03-20T13:00:00Z',
    },
  },
]

const emptyResponse = { threads: [], total: 0, page: 1, page_size: 20, total_pages: 0 }

describe('FeedbackHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListMyThreads.mockResolvedValue(emptyResponse)
  })

  const renderHistoryPage = (initialUrl = '/history') => {
    render(
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/history" element={<FeedbackHistoryPage />} />
          <Route path="/history/:appKey" element={<FeedbackHistoryPage />} />
          <Route path="/submit/:appKey" element={<div>Submit Page</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  describe('Loading and Empty States', () => {
    it('shows loading state while fetching threads', async () => {
      let resolve!: (value: typeof emptyResponse) => void
      mockListMyThreads.mockImplementation(
        () => new Promise((r) => { resolve = r as unknown as typeof mockListMyThreads })
      )
      renderHistoryPage()
      expect(screen.getByText('加载中...')).toBeInTheDocument()
      resolve(emptyResponse)
    })

    it('shows empty state when no threads exist', async () => {
      mockListMyThreads.mockResolvedValue(emptyResponse)
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('您还没有提交过反馈')).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: '提交反馈' })).toHaveAttribute('href', '/submit/demo-app')
    })

    it('shows empty state with app key when no threads', async () => {
      renderHistoryPage('/history/my-app')

      await waitFor(() => {
        expect(screen.getByText('您还没有提交过反馈')).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: '提交反馈' })).toHaveAttribute('href', '/submit/my-app')
    })

    it('shows error state with retry button', async () => {
      mockListMyThreads.mockRejectedValue(new Error('网络错误'))
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('网络错误')
      })
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    })
  })

  describe('Thread List Display', () => {
    it('renders list of threads with correct content', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('应用经常崩溃')).toBeInTheDocument()
        expect(screen.getByText('希望增加暗色模式')).toBeInTheDocument()
      })
    })

    it('displays status badges for each thread', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('处理中')).toBeInTheDocument()
        expect(screen.getByText('已收到')).toBeInTheDocument()
      })
    })

    it('displays category labels', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: [mockThreads[0]],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('遇到问题')).toBeInTheDocument()
      })
    })

    it('shows results count info', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('共 2 条反馈')).toBeInTheDocument()
      })
    })
  })

  describe('Search and Filter Bar', () => {
    it('renders keyword search input', async () => {
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('搜索反馈内容...')).toBeInTheDocument()
      })
    })

    it('renders filter toggle button', async () => {
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /筛选/i })).toBeInTheDocument()
      })
    })

    it('shows expanded filters when toggle is clicked', async () => {
      renderHistoryPage()

      await waitFor(() => {
        const toggleBtn = screen.getByRole('button', { name: /筛选/i })
        fireEvent.click(toggleBtn)
      })

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('shows active filter indicator when filters are active', async () => {
      renderHistoryPage('/history?status=received')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /筛选/i })).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('does not show pagination when only one page', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('应用经常崩溃')).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: /上一页/i })).not.toBeInTheDocument()
    })

    it('shows pagination when multiple pages exist', async () => {
      const manyThreads = Array.from({ length: 20 }, (_, i) => ({
        ...mockThreads[0],
        id: `thread-${i}`,
        summary: `反馈 ${i}`,
      }))
      mockListMyThreads.mockResolvedValue({
        threads: manyThreads,
        total: 45,
        page: 1,
        page_size: 20,
        total_pages: 3,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument()
      })
      // Use aria-label selectors since accessible name differs from visible text
      expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument()
    })

    it('disables previous button on first page', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 45,
        page: 1,
        page_size: 20,
        total_pages: 3,
      })
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
        expect(screen.getByRole('button', { name: '下一页' })).not.toBeDisabled()
      })
    })

    it('disables next button on last page', async () => {
      mockListMyThreads.mockResolvedValue({
        threads: mockThreads,
        total: 45,
        page: 3,
        page_size: 20,
        total_pages: 3,
      })
      renderHistoryPage('/history?page=3')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '上一页' })).not.toBeDisabled()
        expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()
      })
    })
  })

  describe('Back Navigation', () => {
    it('renders back link to home', async () => {
      renderHistoryPage()

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '← 返回首页' })).toHaveAttribute('href', '/')
      })
    })
  })
})
