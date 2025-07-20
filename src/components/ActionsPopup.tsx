import { useRef, useState, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';

interface Action {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'default' | 'outline';
}

interface ActionsPopupProps {
  trigger?: React.ReactNode;
  actions: Action[];
  align?: 'left' | 'center' | 'right';
}

export default function ActionsPopup({ trigger, actions, align = 'center' }: ActionsPopupProps) {
  const [showPopup, setShowPopup] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(typeof window !== 'undefined');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (showPopup && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      if (align === 'left') left = rect.left;
      if (align === 'right') left = rect.right;
      setPopupStyle({
        position: 'fixed',
        left,
        top: rect.bottom + 8,
        zIndex: 2000, // ensure it's above most content
        transform: align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : undefined,
      });
    }
  }, [showPopup, align, mounted]);

  useEffect(() => {
    if (!mounted || !showPopup) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setShowPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup, mounted]);

  useEffect(() => {
    if (!mounted) return;
    let root = document.getElementById('actions-popup-portal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'actions-popup-portal-root';
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setShowPopup((v) => !v)}
        style={{ display: 'inline-block', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        aria-label="Show actions"
        type="button"
      >
        {trigger || <MoreHorizontal size={20} />}
      </button>
      {showPopup && portalRoot && typeof window !== 'undefined' && createPortal(
        <div
          ref={popupRef}
          style={popupStyle}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-3 flex flex-col gap-2 items-stretch min-w-[180px]"
        >
          {/* Pointer arrow */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 overflow-hidden pointer-events-none">
            <div className="w-4 h-4 bg-white dark:bg-gray-900 border-l border-t border-gray-200 dark:border-gray-700 rotate-45 mx-auto"></div>
          </div>
          {actions.map((action, i) => (
            <Button
              key={i}
              size="sm"
              variant={action.variant || 'default'}
              className="w-full"
              onClick={(e) => {
                action.onClick(e);
                setShowPopup(false);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>,
        portalRoot
      )}
    </div>
  );
} 