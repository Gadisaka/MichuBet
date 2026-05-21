/** Soft glassy surface — matches deposit / auth account palette */
export function SoftPanel({ children, className = "", style }) {
  return (
    <div
      style={style}
      className={`rounded-[1.75rem] bg-gradient-to-br from-[#1f2038]/95 via-[#18182a]/98 to-[#12121f]/95 px-5 py-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.55)] ring-1 ring-[#3d3f5c]/40 backdrop-blur-md transition-shadow duration-500 hover:shadow-[0_28px_60px_-18px_rgba(56,203,191,0.12)] ${className}`}
    >
      {children}
    </div>
  );
}

export default SoftPanel;
