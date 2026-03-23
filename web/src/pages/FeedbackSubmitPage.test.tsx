import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { FeedbackSubmitPage } from './FeedbackSubmitPage'
import * as api from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  createThreadAtomic: vi.fn(),
  STATUS_LABELS: {
    received: '已收到',
    in_review: '处理中',
    waiting_for_user: '待补充信息',
    closed: '已关闭',
  },
}))

const mockCreateThreadAtomic = api.createThreadAtomic as ReturnType<typeof vi.fn>

describe('FeedbackSubmitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderSubmitPage = () => {
    render(
      <MemoryRouter initialEntries={['/submit/demo-app']}>
        <Routes>
          <Route path="/submit/:appKey" element={<FeedbackSubmitPage />} />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/feedback/:threadId" element={<div>Thread Detail</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  describe('Category Selection', () => {
    it('shows category selection on initial load', () => {
      renderSubmitPage()
      expect(screen.getByText('请选择反馈类型：')).toBeInTheDocument()
      expect(screen.getByText('遇到问题')).toBeInTheDocument()
      expect(screen.getByText('想提建议')).toBeInTheDocument()
    })

    it('advances to form when category is selected', () => {
      renderSubmitPage()
      fireEvent.click(screen.getByText('遇到问题'))
      expect(screen.getByPlaceholderText('请详细描述您的问题或建议...')).toBeInTheDocument()
    })
  })

  describe('Submit Flow', () => {
    it('calls createThreadAtomic with summary as first line of content', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: 'test-thread-id',
        message_id: 'test-message-id',
      })

      renderSubmitPage()

      // Select category
      fireEvent.click(screen.getByText('遇到问题'))

      // Fill form
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, {
        target: { value: '这是一个测试反馈内容' },
      })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        expect(mockCreateThreadAtomic).toHaveBeenCalledWith(
          '遇到问题',
          '这是一个测试反馈内容',
          '这是一个测试反馈内容',
          undefined,
          expect.objectContaining({
            current_route: '/submit/demo-app',
          }),
          undefined,
        )
      })
    })

    it('uses only the first line as summary for multi-line content', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: 'multiline-thread-id',
        message_id: 'test-message-id',
      })

      renderSubmitPage()
      fireEvent.click(screen.getByText('遇到问题'))

      const multiLineContent = '第一行是摘要\n第二行是详细描述\n第三行更多细节'
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: multiLineContent } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        expect(mockCreateThreadAtomic).toHaveBeenCalledWith(
          '遇到问题',
          '第一行是摘要',
          multiLineContent,
          undefined,
          expect.objectContaining({
            current_route: '/submit/demo-app',
          }),
          undefined,
        )
      })
    })

    it('truncates summary at 120 chars with ellipsis for long first line', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: 'long-thread-id',
        message_id: 'test-message-id',
      })

      renderSubmitPage()
      fireEvent.click(screen.getByText('遇到问题'))

      const longLine = 'A'.repeat(200)
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: longLine } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        const calledSummary = mockCreateThreadAtomic.mock.calls[0][1]
        const calledBody = mockCreateThreadAtomic.mock.calls[0][2]
        expect(calledSummary).toBe('A'.repeat(117) + '...')
        expect(calledSummary.length).toBe(120)
        expect(calledBody).toBe(longLine)
      })
    })

    it('shows confirmation page with human-friendly ref number on success', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: '0193a7b2-c3d4-7e8f-9a0b-1c2d3e4f5a6b',
        message_id: 'test-message-id',
      })

      renderSubmitPage()

      fireEvent.click(screen.getByText('遇到问题'))
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: '测试反馈' } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        // Should show human-friendly ref number, not raw UUID
        expect(screen.getByText('FB-A7B2C3')).toBeInTheDocument()
        expect(screen.getByText('感谢您的反馈')).toBeInTheDocument()
      })
    })

    it('shows error message on submit failure', async () => {
      mockCreateThreadAtomic.mockRejectedValueOnce(new Error('服务器错误'))

      renderSubmitPage()

      fireEvent.click(screen.getByText('遇到问题'))
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: '测试反馈' } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('服务器错误')
      })
    })

    it('does NOT call createThread + addMessage separately (atomic only)', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: 'atomic-thread-id',
        message_id: 'atomic-message-id',
      })

      renderSubmitPage()

      fireEvent.click(screen.getByText('想提建议'))
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: '建议内容' } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        // createThreadAtomic should be called (the atomic endpoint)
        expect(mockCreateThreadAtomic).toHaveBeenCalledTimes(1)
      })
    })

    it('shows submit button is present and labeled correctly', () => {
      renderSubmitPage()

      fireEvent.click(screen.getByText('遇到问题'))

      const submitButton = screen.getByRole('button', { name: '提交反馈' })
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).toHaveAttribute('type', 'submit')
    })
  })

  describe('Confirmation Page', () => {
    it('shows "查看详情" link with correct thread ID', async () => {
      mockCreateThreadAtomic.mockResolvedValueOnce({
        thread_id: 'confirmation-thread-id',
        message_id: 'msg-id',
      })

      renderSubmitPage()

      fireEvent.click(screen.getByText('遇到问题'))
      const textarea = screen.getByPlaceholderText('请详细描述您的问题或建议...')
      fireEvent.change(textarea, { target: { value: '内容' } })
      fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

      await waitFor(() => {
        const detailLink = screen.getByText('查看详情')
        expect(detailLink).toHaveAttribute('href', '/feedback/confirmation-thread-id')
      })
    })
  })
})
