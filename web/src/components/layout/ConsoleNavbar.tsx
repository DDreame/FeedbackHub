import { type FC } from 'react';

export type ConsoleTab = 'tickets' | 'analytics' | 'settings';

interface ConsoleNavbarProps {
  activeTab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  unreadCount?: number;
}

export const ConsoleNavbar: FC<ConsoleNavbarProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
}) => {
  const tabs: { id: ConsoleTab; label: string; showBadge?: boolean }[] = [
    { id: 'tickets', label: '对话', showBadge: true },
    { id: 'analytics', label: '分析' },
    { id: 'settings', label: '设置' },
  ];

  return (
    <nav className="fh-navbar">
      <div className="fh-navbar-brand">
        <div className="fh-logo">F</div>
        FeedbackHub
      </div>
      <div className="fh-navbar-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`fh-navbar-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.showBadge && unreadCount > 0 && (
              <span className="fh-badge">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
