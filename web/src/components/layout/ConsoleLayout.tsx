import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ConsoleNavbar, type ConsoleTab } from './ConsoleNavbar';
import { MobileInfoStrip, type MobileTicketMeta } from './MobileInfoStrip';
import '../../styles/theme.css';
import '../../styles/console.css';

/* ══════════════════════════════════════════════
   Slot props — each panel receives its content
   via render props typed to the panel's role.
   ============================================== */

export interface TicketListSlotProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export interface ConversationSlotProps {
  /** True when the mobile overlay is showing the conversation */
  isMobileActive: boolean;
}

export interface TicketNavSlotProps {
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export interface ConsoleLayoutProps {
  /* ── Navbar ── */
  activeTab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  unreadCount?: number;

  /* ── Mobile info strip ── */
  mobileTicketMeta: MobileTicketMeta | null;
  statusOptions: Array<{ value: string; label: string }>;

  /* ── Mobile ticket nav ── */
  mobileNav: TicketNavSlotProps;

  /* ── Slots ── */
  ticketListSlot: (props: TicketListSlotProps) => ReactNode;
  conversationSlot: (props: ConversationSlotProps) => ReactNode;
  infoPanelSlot: () => ReactNode;
  analyticsSlot: () => ReactNode;
  settingsSlot: () => ReactNode;

  /* ── Mobile actions ── */
  onMobileBack?: () => void;
}

const MOBILE_BREAKPOINT = 768;

export const ConsoleLayout: FC<ConsoleLayoutProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  mobileTicketMeta,
  statusOptions,
  mobileNav,
  ticketListSlot,
  conversationSlot,
  infoPanelSlot,
  analyticsSlot,
  settingsSlot,
  onMobileBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );
  const [searchValue, setSearchValue] = useState('');
  const [mobileConvActive, setMobileConvActive] = useState(false);

  /* ── ResizeObserver for responsive breakpoint ── */
  useEffect(() => {
    const el = containerRef.current?.parentElement ?? containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsMobile(entry.contentRect.width <= MOBILE_BREAKPOINT);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Mobile back handler ── */
  const handleMobileBack = useCallback(() => {
    setMobileConvActive(false);
    onMobileBack?.();
  }, [onMobileBack]);

  /* ── Render helpers ── */
  const showTicketList = !isMobile || (isMobile && !mobileConvActive);
  const showConversation = !isMobile || (isMobile && mobileConvActive);

  return (
    <div className="fh-console">
      <ConsoleNavbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setMobileConvActive(false);
          onTabChange(tab);
        }}
        unreadCount={unreadCount}
      />

      {activeTab === 'tickets' && (
        <div className="fh-console-layout" ref={containerRef}>
          {/* Left: Ticket List */}
          {showTicketList && (
            <div className="fh-ticket-list-panel">
              <div className="fh-ticket-list-search">
                <input
                  type="text"
                  placeholder="搜索反馈..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
              <div className="fh-ticket-list-items">
                {ticketListSlot({
                  searchValue,
                  onSearchChange: setSearchValue,
                })}
              </div>
            </div>
          )}

          {/* Center: Conversation */}
          <div
            className={`fh-conversation-panel${isMobile && mobileConvActive ? ' mobile-active' : ''}`}
          >
            {isMobile && (
              <div className="fh-mobile-back" onClick={handleMobileBack}>
                <span className="fh-arrow">←</span> 返回工单列表
              </div>
            )}
            {isMobile && (
              <MobileInfoStrip
                ticket={mobileTicketMeta}
                statusOptions={statusOptions}
              />
            )}
            {showConversation && (
              conversationSlot({ isMobileActive: isMobile && mobileConvActive })
            )}
            {isMobile && mobileConvActive && (
              <div className="fh-mobile-ticket-nav">
                <button
                  disabled={mobileNav.currentIndex <= 0}
                  onClick={mobileNav.onPrev}
                >
                  ← 上一项
                </button>
                <span className="fh-nav-count">
                  {mobileNav.currentIndex + 1} / {mobileNav.totalCount}
                </span>
                <button
                  disabled={mobileNav.currentIndex >= mobileNav.totalCount - 1}
                  onClick={mobileNav.onNext}
                >
                  下一项 →
                </button>
              </div>
            )}
          </div>

          {/* Right: Info Panel */}
          {!isMobile && (
            <div className="fh-info-panel">{infoPanelSlot()}</div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="fh-console-layout">
          <div className="fh-analytics-panel">{analyticsSlot()}</div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="fh-console-layout">
          <div className="fh-conversation-panel" style={{ flex: 1 }}>
            {settingsSlot()}
          </div>
        </div>
      )}
    </div>
  );
};

/* Re-export the hook for child components to trigger mobile overlay */
export { MOBILE_BREAKPOINT };
