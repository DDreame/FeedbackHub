import { type FC, useState } from 'react';
import { type DevMessageResponse, type ResponseTemplateRow } from '../../services/api';

interface TicketDetailProps {
  messages: DevMessageResponse[];
  templates: ResponseTemplateRow[];
  onSendReply: (body: string) => void;
  /** True when mobile overlay is active (shows back button from layout) */
  isMobileActive?: boolean;
}

export const TicketDetail: FC<TicketDetailProps> = ({
  messages,
  templates,
  onSendReply,
  isMobileActive,
}) => {
  const [composerValue, setComposerValue] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);

  const handleSend = () => {
    const trimmed = composerValue.trim();
    if (!trimmed) return;
    onSendReply(trimmed);
    setComposerValue('');
  };

  const handleInsertTemplate = (template: ResponseTemplateRow) => {
    setComposerValue(template.body);
    setTemplateOpen(false);
  };

  return (
    <>
      {/* Messages */}
      <div className="fh-conversation-messages" id="fh-conv-messages">
        {messages.length === 0 ? (
          <div className="fh-conversation-empty">
            <div className="fh-empty-icon">💬</div>
            <div className="fh-empty-text">暂无消息</div>
          </div>
        ) : (
          messages.map((msg) => {
            const side = msg.author_type === 'reporter' ? 'user' : 'dev';
            const name = msg.author_type === 'reporter' ? '用户' : '你';
            return (
              <div key={msg.id} className={`fh-message-row ${side}`}>
                <div className="fh-message-bubble">
                  <div className="fh-message-meta">
                    {name} · {formatTime(msg.created_at)}
                  </div>
                  {msg.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="fh-conversation-composer">
        <div className="fh-composer-input-row">
          <textarea
            placeholder="输入回复..."
            rows={1}
            value={composerValue}
            onChange={(e) => setComposerValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <div className="fh-composer-actions">
          {templates.length > 0 && (
            <div className={`fh-template-dropdown${templateOpen ? ' open' : ''}`}>
              <button
                className="fh-btn"
                onClick={() => setTemplateOpen(!templateOpen)}
              >
                模板 ▼
              </button>
              <div className="fh-template-menu">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="fh-template-item"
                    onClick={() => handleInsertTemplate(tpl)}
                  >
                    <div className="fh-tpl-title">{tpl.title}</div>
                    <div className="fh-tpl-preview">
                      {tpl.body.slice(0, 40)}
                      {tpl.body.length > 40 ? '...' : ''}
                    </div>
                  </div>
                ))}
                <div className="fh-template-footer">管理模板 →</div>
              </div>
            </div>
          )}
          <button className="fh-btn fh-btn-primary" onClick={handleSend}>
            发送
          </button>
        </div>
      </div>
    </>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
