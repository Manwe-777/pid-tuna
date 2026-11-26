export function PanelLayout({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fc-msc__panel-head">
        <span className="fc-msc__panel-title">{title}</span>
        <button type="button" className="fc-msc__close" onClick={onClose} aria-label="Close" title="Close">
          ✕
        </button>
      </div>
      <div className="fc-msc__panel-body">{children}</div>
    </>
  );
}
