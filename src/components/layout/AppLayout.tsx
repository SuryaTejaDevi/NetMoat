import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 pb-20 lg:pb-0 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
