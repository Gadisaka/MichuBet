import AppIcon from './AppIcon'

function SectionHeader({ icon = 'trophy', title, rightText, className = '' }) {
  return (
    <header
      className={`flex items-center justify-between border-b border-b-[#303046] px-3 py-2.5 text-[15px] font-extrabold text-[#ecedf9] ${className}`.trim()}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-[14px] w-[14px] items-center justify-center text-[#fafbff]">
          <AppIcon name={icon} size={12} strokeWidth={2.4} />
        </span>
        <span>{title}</span>
      </div>
      {rightText ? <span>{rightText}</span> : null}
    </header>
  )
}

export default SectionHeader
