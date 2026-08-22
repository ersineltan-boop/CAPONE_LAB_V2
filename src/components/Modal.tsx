import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  extraWide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide, extraWide }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Kapat"
      />

      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto border border-line bg-cream shadow-2xl sm:max-h-[85vh] ${
          extraWide ? "max-w-5xl" : wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-cream px-5 py-4 sm:px-6">
          <h2
            id="modal-title"
            className="font-serif text-lg font-medium tracking-wide sm:text-xl"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-xl text-ink-muted transition-colors hover:text-ink"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-6 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
