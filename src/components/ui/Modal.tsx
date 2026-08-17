import React, { useEffect, useRef } from 'react';

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, children, title, size = 'md' }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // Close only via the X button — Escape does not dismiss.
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const closeBtn = sheetRef.current?.querySelector<HTMLElement>('.ox-modal-close');
    (closeBtn || sheetRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ox-modal-root" role="presentation">
      <div
        ref={sheetRef}
        className={['ox-modal-sheet', `ox-modal-sheet--${size}`].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ox-modal-title' : undefined}
        tabIndex={-1}
      >
        {title && (
          <div className="ox-modal-header">
            <h2 id="ox-modal-title" className="ox-modal-title">{title}</h2>
            <button type="button" className="ox-modal-close ox-tap-target" onClick={onClose} aria-label="Close">
              <span className="material-symbols-outlined" aria-hidden>close</span>
            </button>
          </div>
        )}
        <div className="ox-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
