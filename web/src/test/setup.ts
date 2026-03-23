import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Mock react-i18next to return Chinese translation strings in tests
vi.mock('react-i18next', () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      // submit page
      'submit.encounteredProblem': '遇到问题',
      'submit.haveSuggestion': '想提建议',
      'submit.haveQuestion': '想问一下',
      'submit.other': '其他',
      'submit.selectCategory': '请选择反馈类型：',
      'submit.feedbackPlaceholder': '请详细描述您的问题或建议...',
      'submit.contentHint': '请尽量详细描述，这样可以帮助我们更好地解决问题 · Ctrl+Enter 快捷提交',
      'submit.attachScreenshot': '点击或拖拽添加截图',
      'submit.allowContact': '允许开发者联系我',
      'submit.contactPlaceholder': '请输入邮箱地址',
      'submit.back': '上一步',
      'submit.submit': '提交反馈',
      'submit.submitting': '提交中...',
      'submit.confirmTitle': '感谢您的反馈',
      'submit.confirmDescription': '我们已收到您的反馈，会尽快处理。',
      'submit.confirmHint': '您可以在「我的反馈」页面查看处理进度。',
      'submit.backToHome': '返回首页',
      'submit.viewDetails': '查看详情',
      'submit.referenceNumber': '反馈编号',
      'submit.type': '类型',
      'submit.status': '状态',
      'submit.feedbackType': '反馈类型',
      'submit.contentLabel': '反馈内容',
      'submit.eyebrow': '反馈提交',
      'submit.title': '提交反馈',
      'submit.stepCategory': '选择类型',
      'submit.stepForm': '填写内容',
      'submit.stepConfirm': '完成',
      'submit.attachScreenshotLabel': '添加截图（可选，最多5张）',
      'submit.attachmentAlt': '附件 {{index}}',
      'submit.remove': '移除',
      'submit.error': '提交失败，请重试',
      'submit.contentRequired': '请输入反馈内容',
      'submit.invalidEmail': '请输入有效的邮箱地址',
      // history page
      'history.eyebrow': '反馈历史',
      'history.title': '我的反馈',
      'history.noFeedback': '您还没有提交过反馈',
      'history.noResults': '无符合条件的结果',
      'history.searchPlaceholder': '搜索反馈内容...',
      'history.filter': '筛选',
      'history.filterStatus': '状态',
      'history.createdAt': '创建时间',
      'history.clearFilter': '清除筛选',
      'history.submitFeedback': '提交反馈',
      'history.backToHome': '返回首页',
      'history.retry': '重试',
      'history.close': '关闭',
      'history.allStatuses': '全部状态',
      'history.received': '已收到',
      'history.inReview': '处理中',
      'history.waitingForUser': '待补充信息',
      'history.closed': '已关闭',
      'history.previous': '上一页',
      'history.next': '下一页',
      'history.pageInfo': '第 {{current}} / {{total}} 页',
      'history.resultCount': '共 {{count}} 条反馈',
      // notification
      'notification.receivedSubmitted': '✅ 感谢提交，您的反馈已收到',
      'notification.reviewStarted': '👀 开发者已查看您的反馈',
      'notification.waitingResponse': '💬 开发者已回复，等待您的操作',
      'notification.closed': '✅ 此反馈已关闭，如有需要可继续回复',
      // app
      'app.loading': '加载中...',
      'app.loadError': '加载失败',
      // home
      'home.title': 'FeedBack System',
      'home.historyDescription': '查看您提交的所有反馈记录',
      'home.submitFeedback': '提交反馈',
      'home.myFeedback': '我的反馈',
      'home.viewHistory': '查看历史',
      'home.selectApp': '请选择一个应用',
      'home.submitDescription': '遇到问题或有建议？告诉我们',
      // console
      'console.title': 'Developer Console',
      'console.description': '此功能正在开发中。',
      'console.backToHome': '返回首页',
      // theme
      'theme.light': '浅色',
      'theme.dark': '深色',
      'theme.switchToLight': '切换到浅色模式',
      'theme.switchToDark': '切换到深色模式',
    };
    const translation = translations[key];
    if (translation) {
      if (options) {
        return translation.replace(/\{\{(\w+)\}\}/g, (_, k) => String(options[k] ?? ''));
      }
      return translation;
    }
    return key;
  };

  return {
    useTranslation: () => ({ t, i18n: { language: 'zh-CN' } }),
    I18nextProvider: ({ children }: { children: unknown }) => children as unknown,
    initReactI18next: { type: 'i18nextBackend' as const, init: vi.fn() },
  };
});

afterEach(() => {
  cleanup()
});
