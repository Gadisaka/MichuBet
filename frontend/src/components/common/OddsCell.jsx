function OddsCell({
  label,
  value,
  selected,
  onClick,
  className = "",
  layout = "horizontal",
}) {
  const stacked = layout === "stacked";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${
        stacked
          ? "flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-center transition-all duration-200"
          : "flex min-h-8 cursor-pointer items-center justify-between gap-1 rounded-xl border px-2 transition-all duration-200"
      } ${
        selected
          ? "border-[#F6AF01] bg-(--sb-accent-surface-deep) shadow-[0_0_12px_rgba(246,175,1,0.28)]"
          : "border-transparent bg-(--sb-bg-card-elevated) text-[#ffffff] hover:bg-(--sb-bg-card)"
      } ${className}`.trim()}
    >
      {label ? (
        <span
          className={`font-bold text-[#ffffff] ${
            stacked
              ? "max-w-full whitespace-normal break-words text-balance text-[10px] leading-tight"
              : "text-[13px]"
          }`}
        >
          {label}
        </span>
      ) : null}
      <span
        className={`font-bold ${
          stacked ? "text-[13px] leading-none" : "text-sm"
        } ${selected ? "text-[#F6AF01]" : "text-[#ffffff]"}`}
      >
        {value}
      </span>
    </button>
  );
}

export default OddsCell;
