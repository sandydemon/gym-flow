import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface GymStatus {
  gymId: string | null;
  gymName: string | null;
  isActive: boolean;
  loading: boolean;
}

export function useGymStatus() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [gymStatus, setGymStatus] = useState<GymStatus>({
    gymId: null,
    gymName: null,
    isActive: true,
    loading: true,
  });
  const checkInProgress = useRef(false);

  const handleInactiveGym = useCallback(async () => {
    toast({
      title: 'Account Inactive',
      description: 'Your gym account is inactive. Please contact admin.',
      variant: 'destructive',
    });
    await signOut();
    navigate('/gym-auth');
  }, [toast, signOut, navigate]);

  // Force fresh check from database - no caching
  const checkGymStatusFresh = useCallback(async () => {
    if (!user || checkInProgress.current) return;

    checkInProgress.current = true;

    try {
      // Resolve effective owner (sub-users belong to their gym owner)
      const { data: sub } = await supabase
        .from('gym_users')
        .select('gym_owner_id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      // If sub-user is deactivated, log them out
      if (sub && !sub.is_active) {
        checkInProgress.current = false;
        handleInactiveGym();
        return;
      }

      const ownerId = sub?.gym_owner_id ?? user.id;

      const { data: gymData, error } = await supabase
        .from('gyms')
        .select('id, gym_name, is_active')
        .eq('user_id', ownerId)
        .maybeSingle();

      if (error) {
        console.error('Error checking gym status:', error);
        setGymStatus(prev => ({ ...prev, loading: false }));
        checkInProgress.current = false;
        return;
      }

      if (gymData) {
        setGymStatus({
          gymId: gymData.id,
          gymName: gymData.gym_name,
          isActive: gymData.is_active,
          loading: false,
        });

        // If gym is inactive, immediately log them out
        if (!gymData.is_active) {
          checkInProgress.current = false;
          handleInactiveGym();
          return;
        }
      } else {
        setGymStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error in gym status check:', error);
      setGymStatus(prev => ({ ...prev, loading: false }));
    } finally {
      checkInProgress.current = false;
    }
  }, [user, handleInactiveGym]);

  useEffect(() => {
    if (!user) {
      setGymStatus({ gymId: null, gymName: null, isActive: true, loading: false });
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const initializeAndSubscribe = async () => {
      // Always do a fresh check from database on mount
      await checkGymStatusFresh();

      // Get gym ID for subscription after fresh check (resolve via sub-user mapping if needed)
      const { data: sub } = await supabase
        .from('gym_users')
        .select('gym_owner_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const ownerId = sub?.gym_owner_id ?? user.id;
      const { data: gymData } = await supabase
        .from('gyms')
        .select('id')
        .eq('user_id', ownerId)
        .maybeSingle();

      if (gymData) {
        // Set up real-time subscription for this gym's status changes
        channel = supabase
          .channel(`gym-status-${gymData.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'gyms',
              filter: `id=eq.${gymData.id}`,
            },
            (payload) => {
              const newData = payload.new as { is_active: boolean; gym_name: string };
              setGymStatus(prev => ({
                ...prev,
                isActive: newData.is_active,
                gymName: newData.gym_name,
              }));

              // If gym becomes inactive, log them out immediately
              if (!newData.is_active) {
                handleInactiveGym();
              }
            }
          )
          .subscribe();
      }
    };

    initializeAndSubscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, checkGymStatusFresh, handleInactiveGym]);

  return { ...gymStatus, recheckStatus: checkGymStatusFresh };
}
