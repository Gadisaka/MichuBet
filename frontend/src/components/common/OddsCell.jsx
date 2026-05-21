function OddsCell({ label, value, selected, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-8 cursor-pointer items-center justify-between gap-1 rounded-xl border px-2 transition-all duration-200 ${
        selected
          ? "border-[#F6AF01] bg-(--sb-accent-surface-deep) shadow-[0_0_12px_rgba(246,175,1,0.28)]"
          : "border-transparent bg-(--sb-bg-page)/90 text-[#ffffff] hover:bg-(--sb-bg-card)"
      } ${className}`.trim()}
    >
      {label ? (
        <span className="text-[13px] font-bold text-[#ffffff]">{label}</span>
      ) : null}
      <span className={`text-sm font-bold ${selected ? "text-[#F6AF01]" : "text-[#ffffff]"}`}>
        {value}
      </span>
    </button>
  );
}

export default OddsCell;
