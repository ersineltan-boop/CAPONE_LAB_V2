interface ImagePlaceholderProps {
  alt: string;
  className?: string;
  label?: string;
}

export default function ImagePlaceholder({
  alt,
  className = "",
  label,
}: ImagePlaceholderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-cream-dark ${className}`}
      title={alt}
    >
      <span className="text-[8px] uppercase tracking-[0.12em] text-ink-faint">
        {label ?? "Görsel yok"}
      </span>
    </div>
  );
}
