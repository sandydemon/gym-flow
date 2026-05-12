import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dumbbell, Edit, Trash2, Heart } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Abs', 'Forearms', 'Calves', 'Full Body', 'Rest'];
const CARDIO_OPTIONS = ['None', 'Treadmill', 'Cycling', 'Elliptical', 'Rowing', 'HIIT', 'Jump Rope', 'Stairmaster', 'Walking'];

interface Plan {
  id: string;
  day_of_week: string;
  body_parts: string[];
  cardio: string | null;
  notes: string | null;
}

interface Props {
  paidTrainingMemberId: string;
}

export default function WorkoutPlanCard({ paidTrainingMemberId }: Props) {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const qc = useQueryClient();
  const [editDay, setEditDay] = useState<string | null>(null);
  const [form, setForm] = useState<{ body_parts: string[]; cardio: string; notes: string }>({
    body_parts: [], cardio: 'None', notes: '',
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['workout-plans', paidTrainingMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('member_id', paidTrainingMemberId);
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!paidTrainingMemberId,
  });

  const planByDay = (day: string) => plans.find(p => p.day_of_week === day);

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!editDay) return;
      const existing = planByDay(editDay);
      const payload: any = {
        member_id: paidTrainingMemberId,
        user_id: gymOwnerId!,
        day_of_week: editDay,
        body_parts: form.body_parts,
        cardio: form.cardio === 'None' ? null : form.cardio,
        notes: form.notes || null,
      };
      let error;
      if (existing) {
        ({ error } = await supabase
          .from('workout_plans')
          .update(payload as any)
          .eq('id', existing.id));
      } else {
        ({ error } = await supabase
          .from('workout_plans')
          .insert(payload as any));
      }
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-plans', paidTrainingMemberId] });
      toast.success('Workout saved');
      setEditDay(null);
    },
    onError: () => toast.error('Failed to save workout'),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-plans', paidTrainingMemberId] });
      toast.success('Day cleared');
    },
  });

  const openEdit = (day: string) => {
    const existing = planByDay(day);
    setForm({
      body_parts: existing?.body_parts || [],
      cardio: existing?.cardio || 'None',
      notes: existing?.notes || '',
    });
    setEditDay(day);
  };

  const togglePart = (part: string) => {
    setForm(f => ({
      ...f,
      body_parts: f.body_parts.includes(part)
        ? f.body_parts.filter(p => p !== part)
        : [...f.body_parts, part],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Dumbbell className="h-4 w-4" /> Weekly Workout Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {DAYS.map(day => {
            const plan = planByDay(day);
            return (
              <div
                key={day}
                className="rounded-lg border border-border p-3 space-y-2 bg-card hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{day.slice(0, 3)}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(day)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    {plan && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deletePlan.mutate(plan.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {plan ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {plan.body_parts.map(bp => (
                        <Badge key={bp} variant="secondary" className="text-[10px] px-1.5 py-0">{bp}</Badge>
                      ))}
                    </div>
                    {plan.cardio && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Heart className="h-3 w-3" /> {plan.cardio}
                      </div>
                    )}
                    {plan.notes && <p className="text-[11px] text-muted-foreground italic">"{plan.notes}"</p>}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Tap edit to plan</p>
                )}
              </div>
            );
          })}
        </div>

        <Dialog open={!!editDay} onOpenChange={(o) => !o && setEditDay(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editDay} Workout</DialogTitle>
              <DialogDescription className="sr-only">
                Plan workout exercises for {editDay}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Body Parts</Label>
                <div className="flex flex-wrap gap-1.5">
                  {BODY_PARTS.map(bp => (
                    <button
                      key={bp}
                      type="button"
                      onClick={() => togglePart(bp)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        form.body_parts.includes(bp)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {bp}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Cardio</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CARDIO_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, cardio: c }))}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        form.cardio === c
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Notes (optional)</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. 4 sets, drop-sets"
                />
              </div>
              <Button className="w-full" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                Save Workout
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
