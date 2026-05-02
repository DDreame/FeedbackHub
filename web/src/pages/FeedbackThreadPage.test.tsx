import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { FeedbackThreadPage } from './FeedbackThreadPage'
import * as api from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  getThread: vi.fn(),
  listMessages: vi.fn(),
  addMessage: vi.fn(),
  STATUS_LABELS: {
    received: '已收到',
    in_review: '处理中',
    waiting_for_user: '待补充信息',
    closed: '已关闭',
  },
}))

const mockGetThread = api.getThread as ReturnType<typeof vi.fn>
const mockListMessages = api.listMessages as ReturnType<typeof vi.fn>
const mockAddMessage = api.addMessage as ReturnType<typeof vi.fn>

const mockThread = {
  id: 'thread-123',
  reporter_id: 'reporter-456',
  category: '遇到问题',
  status: 'in_review',
  summary: '应用崩溃了',
  latest_public_message_at: '2026-03-21T10:00:00Z',
  created_at: '2026-03-21T09:00:00Z',
  updated_at: '2026-03-21T10:00:00Z',
  closed_at: null,
  context: {
    app_version: '1.0.0',
    os_name: 'iOS',
    os_version: '17.0',
    device_model: 'iPhone 15',
    current_route: '/feedback/thread-123',
    captured_at: '2026-03-21T09:00:00Z',
  },
}

const mockMessages = [
  {
    id: 'msg-001',
    thread_id: 'thread-123',
    author_type: 'reporter',
    body: '应用每次打开就闪退，请帮忙处理',
    created_at: '2026-03-21T09:00:00Z',
  },
  {
    id: 'msg-002',
    thread_id: 'thread-123',
    author_type: 'developer',
    body: '感谢反馈，我们正在调查中。',
    created_at: '2026-03-21T10:00:00Z',
  },
]

describe('FeedbackThreadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement scrollIntoView - mock it
    Element.prototype.scrollIntoView = vi.fn()
  })

  const renderThreadPage = () => {
    render(
      <MemoryRouter initialEntries={['/feedback/thread-123']}>
        <Routes>
          <Route path="/feedback/:threadId" element={<FeedbackThreadPage />} />
          <Route path="/history" element={<div>History Page</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  describe('Initial Load', () => {
    it('shows loading state while fetching thread and messages', () => {
      mockGetThread.mockImplementation(() => new Promise(() => {}))
      mockListMessages.mockImplementation(() => new Promise(() => {}))

      renderThreadPage()
      expect(screen.getByText('加载中...')).toBeInTheDocument()
    })

    it('displays initial feedback content in thread history', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('应用每次打开就闪退，请帮忙处理')).toBeInTheDocument()
      })
    })

    it('shows thread header with status and category', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('遇到问题')).toBeInTheDocument()
        expect(screen.getByText('处理中')).toBeInTheDocument()
      })
    })

    it('shows developer reply with correct styling', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        const devMessage = screen.getByText('感谢反馈，我们正在调查中。')
        expect(devMessage).toBeInTheDocument()
        expect(devMessage.closest('.message')).toHaveClass('message-developer')
      })
    })
  })

  describe('Reply Flow', () => {
    it('sends reply and refreshes thread status', async () => {
      const closedThread = {
        ...mockThread,
        status: 'closed',
        closed_at: '2026-03-21T09:30:00Z',
      }

      const reopenedThread = {
        ...mockThread,
        status: 'in_review',
        closed_at: null,
      }

      mockGetThread.mockResolvedValueOnce(closedThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)
      mockAddMessage.mockResolvedValueOnce({
        id: 'msg-003',
        thread_id: 'thread-123',
        author_type: 'reporter',
        body: '好的，等你们的进展',
        created_at: '2026-03-21T11:00:00Z',
      })
      mockGetThread.mockResolvedValueOnce(reopenedThread)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.queryByText('已关闭')).not.toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('输入您的回复...')
      fireEvent.change(textarea, { target: { value: '好的，等你们的进展' } })

      const sendButton = screen.getByRole('button', { name: '发送' })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          'thread-123',
          '好的，等你们的进展',
          'reporter',
        )
      })

      await waitFor(() => {
        expect(screen.getByText('处理中')).toBeInTheDocument()
      })
    })

    it('shows error message when send fails', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)
      mockAddMessage.mockRejectedValueOnce(new Error('发送失败，请检查网络'))

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('应用每次打开就闪退，请帮忙处理')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('输入您的回复...')
      fireEvent.change(textarea, { target: { value: '新回复内容' } })

      fireEvent.click(screen.getByRole('button', { name: '发送' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('发送失败，请检查网络')
      })
    })

    it('does not submit empty reply', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入您的回复...')).toBeInTheDocument()
      })

      const sendButton = screen.getByRole('button', { name: '发送' })
      expect(sendButton).toBeDisabled()
    })
  })

  describe('Messages Display', () => {
    it('shows reporter message with correct author label', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('您')).toBeInTheDocument()
      })
    })

    it('shows developer message with correct author label', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce(mockMessages)

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('开发者')).toBeInTheDocument()
      })
    })

    it('shows empty state when no messages', async () => {
      mockGetThread.mockResolvedValueOnce(mockThread)
      mockListMessages.mockResolvedValueOnce([])

      renderThreadPage()

      await waitFor(() => {
        expect(screen.getByText('暂无消息记录')).toBeInTheDocument()
      })
    })
  })
})
