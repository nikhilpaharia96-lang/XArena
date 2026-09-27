export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] h-72 w-72 rounded-full bg-violet/25 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-cobalt/25 blur-[100px]" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
