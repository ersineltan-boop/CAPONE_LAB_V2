import { useState } from "react";
import Modal from "./Modal";

interface ObservationModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ObservationModal({ open, onClose }: ObservationModalProps) {
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Gözlem Ekle">
      <span className="mb-4 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Demo arayüz — henüz kayıt yapılmaz
      </span>

      {submitted ? (
        <div className="py-8 text-center">
          <p className="font-serif text-lg">Gözlem arayüzü hazır.</p>
          <p className="mt-2 text-sm text-ink-muted">
            Gerçek kayıt sistemi ileride eklenecek.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 border border-ink px-6 py-2.5 text-sm tracking-wide transition-colors hover:bg-ink hover:text-cream"
          >
            Kapat
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm leading-relaxed text-ink-muted">
            Seyahatte çektiğiniz fotoğraf, yeni gördüğünüz marka, ürün linki veya
            kısa notunuzu CAPONE&apos;a ekleyin.
          </p>

          <div>
            <label
              htmlFor="obs-type"
              className="block text-[10px] uppercase tracking-[0.15em] text-ink-faint"
            >
              Gözlem türü
            </label>
            <select
              id="obs-type"
              className="mt-1.5 w-full border border-line bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-ink"
              defaultValue="foto"
            >
              <option value="foto">Fotoğraf</option>
              <option value="marka">Yeni marka</option>
              <option value="link">Ürün linki</option>
              <option value="not">Kısa not</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="obs-location"
              className="block text-[10px] uppercase tracking-[0.15em] text-ink-faint"
            >
              Konum / Pazar
            </label>
            <input
              id="obs-location"
              type="text"
              placeholder="ör. Milano, İtalya"
              className="mt-1.5 w-full border border-line bg-white/60 px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-ink"
            />
          </div>

          <div>
            <label
              htmlFor="obs-note"
              className="block text-[10px] uppercase tracking-[0.15em] text-ink-faint"
            >
              Not
            </label>
            <textarea
              id="obs-note"
              rows={3}
              placeholder="Kısa gözlem notunuz..."
              className="mt-1.5 w-full resize-none border border-line bg-white/60 px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-ink"
            />
          </div>

          <div>
            <label
              htmlFor="obs-file"
              className="block text-[10px] uppercase tracking-[0.15em] text-ink-faint"
            >
              Fotoğraf / Dosya
            </label>
            <input
              id="obs-file"
              type="file"
              accept="image/*"
              className="mt-1.5 w-full text-sm text-ink-muted file:mr-4 file:border file:border-line file:bg-cream file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 border border-ink bg-ink py-2.5 text-sm tracking-wide text-cream transition-colors hover:bg-transparent hover:text-ink"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="border border-line px-5 py-2.5 text-sm tracking-wide text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              İptal
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
