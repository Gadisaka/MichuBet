function Badge({ text, tone = 'neutral' }) {
  const toneClass = tone === 'positive' ? 'bg-[#122624] text-(--sb-accent-soft)' : 'bg-[#34354a] text-[#ecefff]'
  return <span className={`inline-flex items-center rounded-[10px] px-2 py-0.5 text-xs font-extrabold ${toneClass}`}>{text}</span>
}

export default Badge
