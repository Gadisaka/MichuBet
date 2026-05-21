/** Glassy surface — aligns with SoftPanel / MainLayout chrome */
function Panel({
  as: Component = "section",
  className = "",
  children,
  ...rest
}) {
  return (
    <Component
      className={`rounded-[1.15rem] bg-gradient-to-br from-[#1f2038]/92 via-[#0f172b]/96 to-[#0a1122]/95 ring-1 ring-[#3d3f5c]/40 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
}

export default Panel;
