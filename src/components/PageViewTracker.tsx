import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activityLog';

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/members': 'Members',
  '/fees': 'Fees',
  '/attendance': 'Attendance',
  '/paid-training': 'Training',
  '/expenses': 'Expenses',
  '/staff': 'Staff',
  '/reports': 'Reports',
  '/profile': 'Profile',
  '/activity-logs': 'Activity Logs',
};

export default function PageViewTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const last = useRef<string>('');

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    if (last.current === path) return;
    last.current = path;
    const name = PAGE_NAMES[path];
    if (!name) return;
    logActivity({ action_type: 'page_view', description: `Visited ${name}`, page: path });
  }, [location.pathname, user]);

  return null;
}
