function ActionButton({ children, className = '', tone = 'primary' }) {
  const toneClass = tone === 'contrast' ? 'bg-[#f2f3f8] text-[#222]' : 'bg-(--sb-accent-fill) text-[#111]'

  return (
    <button
      type="button"
      className={`cursor-pointer rounded-2xl border-0 font-bold text-xs ${toneClass} ${className}`.trim()}
    >
      {children}
    </button>
  )
}

export default ActionButton
