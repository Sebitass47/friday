// Soft brand-colored glows behind the content so .glass surfaces have something to refract
export default function AmbientGlow() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 left-[18%] w-[760px] h-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(107,70,229,0.24),transparent)] dark:bg-[radial-gradient(closest-side,rgba(107,70,229,0.32),transparent)]" />
      <div className="absolute top-[30%] -right-40 w-[700px] h-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(255,107,157,0.2),transparent)] dark:bg-[radial-gradient(closest-side,rgba(255,107,157,0.24),transparent)]" />
      <div className="absolute -bottom-52 left-[30%] w-[760px] h-[760px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.18),transparent)] dark:bg-[radial-gradient(closest-side,rgba(59,130,246,0.2),transparent)]" />
    </div>
  )
}
