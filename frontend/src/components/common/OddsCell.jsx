function OddsCell({ label, value, selected, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-8 cursor-pointer items-center justify-between gap-1 rounded-xl border px-2 transition-all duration-200 ${
        selected
          ? "border-(--sb-accent) bg-(--sb-accent-surface-deep) shadow-[0_0_12px_rgba(56,203,191,0.28)]"
          : "border-[#3d4f6c]/45 bg-[#101020]/70 hover:bg-[#131d32] hover:ring-1 hover:ring-[#3d4f6c]/35"
      } ${className}`.trim()}
    >
      {label ? (
        <span className="text-[13px] font-bold text-[#f0f2fd]">{label}</span>
      ) : null}
      <span className={`text-sm font-bold ${selected ? "text-(--sb-accent)" : "text-(--sb-accent-soft)"}`}>
        {value}
      </span>
    </button>
  );
}

export default OddsCell;
