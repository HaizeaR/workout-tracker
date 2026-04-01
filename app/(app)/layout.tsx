import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <main className="flex-1 pb-20 overflow-y-auto max-w-2xl mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
