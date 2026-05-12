import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGymOwnerId } from '@/hooks/useGymOwnerId';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search, UserPlus, ArrowLeft, Plus, Trash2, Camera, Ruler, Target, TrendingUp, Image as ImageIcon, Move, Download, UserCog,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { format } from 'date-fns';
import WeightProgressRing from '@/components/WeightProgressRing';
import WorkoutPlanCard from '@/components/paid-training/WorkoutPlanCard';

const TARGETS = ['General', 'Weight Loss', 'Bulk', 'Cut', 'Lean', 'Strength', 'Endurance'];

import { useUserRole } from '@/hooks/useUserRole';

export default function PaidTraining() {
  const { user } = useAuth();
  const gymOwnerId = useGymOwnerId();
  const { data: roleInfo } = useUserRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ memberId: '', height: '', heightFt: '', heightIn: '', target: 'General', trainerId: '', newFee: '', updateFee: false });
  const [editHeightOpen, setEditHeightOpen] = useState(false);
  const [editHeightForm, setEditHeightForm] = useState({ cm: '', ft: '', in: '' });
  const [editTrainerOpen, setEditTrainerOpen] = useState(false);

  const cmToFtIn = (cm: number | null | undefined) => {
    if (!cm) return { ft: '', in: '' };
    const totalInches = Number(cm) / 2.54;
    const ft = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - ft * 12);
    return { ft: String(ft), in: String(inches) };
  };
  const ftInToCm = (ft: string, inches: string) => {
    const f = Number(ft) || 0;
    const i = Number(inches) || 0;
    if (!f && !i) return '';
    return String(Math.round((f * 12 + i) * 2.54));
  };
  const [newWeight, setNewWeight] = useState('');
  const [photoLabel, setPhotoLabel] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null);
  const [measurementForm, setMeasurementForm] = useState({ chest: '', waist: '', hips: '', biceps: '', shoulders: '', thighs: '', calves: '', neck: '' });
  const [addMeasurementOpen, setAddMeasurementOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeForm, setRemoveForm] = useState({ updateFee: false, newFee: '' });
  const [trainerFilter, setTrainerFilter] = useState<string>('all');

  const { data: profile } = useQuery({
    queryKey: ['profile-gym-info', gymOwnerId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('gym_name, logo_url').eq('user_id', gymOwnerId!).single();
      return data;
    },
    enabled: !!gymOwnerId,
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers', gymOwnerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, role')
        .eq('user_id', gymOwnerId!)
        .eq('is_active', true)
        .eq('role', 'Trainer')
        .order('full_name');
      return data || [];
    },
    enabled: !!gymOwnerId,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-members', gymOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, phone, monthly_fee')
        .eq('user_id', gymOwnerId!)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!gymOwnerId,
  });

  const { data: paidMembers = [], isLoading } = useQuery({
    queryKey: ['paid-training-members', gymOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paid_training_members')
        .select('id, member_id, user_id, height, target, trainer_id, created_at, members(full_name, phone)')
        .eq('user_id', gymOwnerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!gymOwnerId,
  });

  const paidMemberIds = paidMembers.map((p: any) => p.member_id);
  const availableMembers = allMembers.filter((m) => !paidMemberIds.includes(m.id));
  const selectedPaidMember = paidMembers.find((p: any) => p.id === selectedMemberId);
  const actualMemberId = (selectedPaidMember as any)?.member_id ?? null;

  // Weight history for selected member
  const { data: weightHistory = [] } = useQuery<any[]>({
    queryKey: ['weight-progress', actualMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_progress')
        .select('*')
        .eq('member_id', actualMemberId!)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!actualMemberId,
  });

  // Photos for selected member
  const { data: photos = [] } = useQuery<any[]>({
    queryKey: ['progress-photos', actualMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('member_id', actualMemberId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!actualMemberId,
  });

  // Body measurements for selected member
  const { data: measurements = [] } = useQuery<any[]>({
    queryKey: ['body-measurements', actualMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('member_id', actualMemberId!)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!actualMemberId,
  });

  const addMeasurement = useMutation({
    mutationFn: async () => {
      const entry: any = {
        member_id: actualMemberId!,
        user_id: gymOwnerId!,
      };
      const fields = ['chest', 'waist', 'hips', 'biceps', 'shoulders', 'thighs', 'calves', 'neck'] as const;
      fields.forEach(f => { if (measurementForm[f]) entry[f] = Number(measurementForm[f]); });
      const { error } = await supabase.from('body_measurements').insert(entry as any);
      if (error) {
        if (error.code === '23505') {
          toast.error('Measurement already recorded');
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements', actualMemberId] });
      setMeasurementForm({ chest: '', waist: '', hips: '', biceps: '', shoulders: '', thighs: '', calves: '', neck: '' });
      setAddMeasurementOpen(false);
      toast.success('Measurement recorded');
    },
    onError: () => toast.error('Failed to save measurement'),
  });

  const deleteMeasurement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('body_measurements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements', actualMemberId] });
      toast.success('Measurement deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('paid_training_members').insert({
        member_id: addForm.memberId,
        user_id: gymOwnerId!,
        height: addForm.height ? Number(addForm.height) : null,
        target: addForm.target,
        trainer_id: addForm.trainerId || null,
      } as any);
      if (error) throw error;

      if (addForm.updateFee && addForm.newFee) {
        const { error: feeError } = await supabase
          .from('members')
          .update({ monthly_fee: Number(addForm.newFee) })
          .eq('id', addForm.memberId);
        if (feeError) throw feeError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paid-training-members'] });
      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      setAddDialogOpen(false);
      setAddForm({ memberId: '', height: '', heightFt: '', heightIn: '', target: 'General', trainerId: '', newFee: '', updateFee: false });
      toast.success('Member added to paid training');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const removeMember = useMutation({
    mutationFn: async ({ id, updateFee, newFee, memberId }: { id: string; updateFee: boolean; newFee: string; memberId: string }) => {
      if (updateFee && newFee) {
        const { error: feeError } = await supabase
          .from('members')
          .update({ monthly_fee: Number(newFee) })
          .eq('id', memberId);
        if (feeError) throw feeError;
      }
      const { error } = await supabase.from('paid_training_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paid-training-members'] });
      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      setSelectedMemberId(null);
      setRemoveDialogOpen(false);
      setRemoveForm({ updateFee: false, newFee: '' });
      toast.success('Member removed from paid training');
    },
    onError: () => toast.error('Failed to remove'),
  });

  // Add weight - using member_id
  const addWeight = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('weight_progress').insert({
        member_id: actualMemberId!,
        user_id: gymOwnerId!,
        weight: Number(newWeight),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-progress', actualMemberId] });
      setNewWeight('');
      toast.success('Weight recorded');
    },
    onError: () => toast.error('Failed to record weight'),
  });

  // Upload photo - using member_id
  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actualMemberId) return;

    const ext = file.name.split('.').pop();
    const filePath = `${user!.id}/${actualMemberId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(filePath, file);
    if (uploadError) { toast.error('Upload failed'); return; }

    const { data: urlData } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(filePath);

    const { error } = await supabase.from('progress_photos').insert({
      member_id: actualMemberId,
      user_id: gymOwnerId!,
      photo_url: urlData.publicUrl,
      label: photoLabel || null,
    } as any);
    if (error) { toast.error('Failed to save photo'); return; }

    queryClient.invalidateQueries({ queryKey: ['progress-photos', selectedMemberId] });
    setPhotoLabel('');
    toast.success('Photo uploaded');
  };

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; photo_url: string }) => {
      const url = new URL(photo.photo_url);
      const pathParts = url.pathname.split('/progress-photos/');
      if (pathParts[1]) {
        await supabase.storage.from('progress-photos').remove([pathParts[1]]);
      }
      const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-photos', selectedMemberId] });
      toast.success('Photo deleted');
    },
    onError: () => toast.error('Failed to delete photo'),
  });

  const updateMember = useMutation({
    mutationFn: async (updates: { height?: number | null; target?: string; trainer_id?: string | null }) => {
      const { error } = await supabase
        .from('paid_training_members')
        .update(updates)
        .eq('id', actualMemberId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paid-training-members'] });
      toast.success('Updated');
    },
  });

  const downloadProgressReport = async () => {
    if (!selectedPaidMember) return;
    const memberData = (selectedPaidMember as any).members;
    const gymName = profile?.gym_name || 'My Gym';
    const logoUrl = (profile as any)?.logo_url || null;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let logoImg: string | null = null;
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoImg = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) { console.error('Failed to load logo', e); }
    }

    doc.setFillColor(30, 30, 40);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    let textCenterX = pageWidth / 2;
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 10, 5, 30, 30);
      textCenterX = (pageWidth + 40) / 2;
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(gymName, textCenterX, 18, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Client Progress Report', textCenterX, 28, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, textCenterX, 35, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let y = 52;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Client Information', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const info = [
      ['Name', memberData?.full_name || '—'],
      ['Phone', memberData?.phone || '—'],
      ['Height', `${(selectedPaidMember as any).height || '—'} cm`],
      ['Target', (selectedPaidMember as any).target || '—'],
      ['Current Weight', weightHistory.length > 0 ? `${(weightHistory[0] as any).weight} kg` : '—'],
    ];
    info.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 60, y);
      y += 7;
    });

    if (weightHistory.length > 0) {
      y += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Weight Progress', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Weight (kg)']],
        body: weightHistory.map((w: any) => [
          format(new Date(w.recorded_at), 'dd MMM yyyy'),
          `${w.weight} kg`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 30, 40] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (measurements.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Body Measurements (inches)', 14, y);
      y += 4;
      const fields = ['chest', 'waist', 'hips', 'biceps', 'shoulders', 'thighs', 'calves', 'neck'];
      autoTable(doc, {
        startY: y,
        head: [['Date', ...fields.map(f => f.charAt(0).toUpperCase() + f.slice(1))]],
        body: measurements.map((m: any) => [
          format(new Date(m.recorded_at), 'dd MMM yyyy'),
          ...fields.map(f => m[f] != null ? String(m[f]) : '—'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 30, 40] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`${gymName} - Progress Report`, 14, doc.internal.pageSize.getHeight() - 10);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    doc.save(`${memberData?.full_name || 'Client'}_Progress_Report.pdf`);
    toast.success('Report downloaded!');
  };

  const isTrainerUser = roleInfo?.role === 'trainer';
  const trainerStaffId = roleInfo?.staffId ?? null;

  const filteredPaid = paidMembers.filter((p: any) => {
    const matchesSearch = p.members?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesTrainer =
      trainerFilter === 'all' ||
      (trainerFilter === 'unassigned' ? !p.trainer_id : p.trainer_id === trainerFilter);
    const matchesScope = !isTrainerUser || (trainerStaffId && p.trainer_id === trainerStaffId);
    return matchesSearch && matchesTrainer && matchesScope;
  });

  if (selectedMemberId && selectedPaidMember) {
    const memberData = (selectedPaidMember as any).members;
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelectedMemberId(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{memberData?.full_name}</h1>
              <p className="text-sm text-muted-foreground">{memberData?.phone || 'No phone'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadProgressReport}>
              <Download className="h-4 w-4 mr-1" /> Progress Report
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Ruler className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Height</p>
                {(() => {
                  const cm = (selectedPaidMember as any).height;
                  const { ft, in: inches } = cmToFtIn(cm);
                  return (
                    <p className="text-lg font-bold">
                      {cm ? `${ft}'${inches}"` : '—'}
                      {cm && <span className="block text-xs font-normal text-muted-foreground">{cm} cm</span>}
                    </p>
                  );
                })()}
                <Dialog open={editHeightOpen} onOpenChange={(open) => {
                  setEditHeightOpen(open);
                  if (open) {
                    const cm = (selectedPaidMember as any).height;
                    const { ft, in: inches } = cmToFtIn(cm);
                    setEditHeightForm({ cm: cm ? String(cm) : '', ft, in: inches });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto">Edit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Height</DialogTitle><DialogDescription className="sr-only">Edit member height in feet and inches</DialogDescription></DialogHeader>
                    <div className="space-y-3">
                      <Label className="text-sm">Feet & Inches</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Feet"
                            value={editHeightForm.ft}
                            onChange={(e) => {
                              const ft = e.target.value;
                              setEditHeightForm({ ...editHeightForm, ft, cm: ftInToCm(ft, editHeightForm.in) });
                            }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ft</span>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Inches"
                            value={editHeightForm.in}
                            onChange={(e) => {
                              const inches = e.target.value;
                              setEditHeightForm({ ...editHeightForm, in: inches, cm: ftInToCm(editHeightForm.ft, inches) });
                            }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">in</span>
                        </div>
                      </div>
                      {editHeightForm.cm && (
                        <p className="text-xs text-muted-foreground">≈ {editHeightForm.cm} cm</p>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => {
                          updateMember.mutate(
                            { height: editHeightForm.cm ? Number(editHeightForm.cm) : null },
                            { onSuccess: () => setEditHeightOpen(false) }
                          );
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-lg font-bold">{(selectedPaidMember as any).target}</p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto">Edit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Target</DialogTitle><DialogDescription className="sr-only">Change member fitness target</DialogDescription></DialogHeader>
                    <Select
                      defaultValue={(selectedPaidMember as any).target}
                      onValueChange={(val) => updateMember.mutate({ target: val })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Current Weight</p>
                <p className="text-lg font-bold">
                  {weightHistory.length > 0 ? `${(weightHistory[0] as any).weight} kg` : '—'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <UserCog className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Trainer</p>
                <p className="text-lg font-bold truncate">
                  {trainers.find((t: any) => t.id === (selectedPaidMember as any).trainer_id)?.full_name || '—'}
                </p>
                <Dialog open={editTrainerOpen} onOpenChange={setEditTrainerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto">
                      {(selectedPaidMember as any).trainer_id ? 'Change' : 'Assign Trainer'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Assign Trainer</DialogTitle><DialogDescription className="sr-only">Assign or change trainer for this member</DialogDescription></DialogHeader>
                    <Select
                      defaultValue={(selectedPaidMember as any).trainer_id || 'none'}
                      onValueChange={(val) => {
                        updateMember.mutate(
                          { trainer_id: val === 'none' ? null : val },
                          { onSuccess: () => setEditTrainerOpen(false) }
                        );
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No trainer</SelectItem>
                        {trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {trainers.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add staff with role "Trainer" first.</p>
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          <WorkoutPlanCard paidTrainingMemberId={(selectedPaidMember as any).member_id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter weight (kg)"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
                <Button
                  onClick={() => addWeight.mutate()}
                  disabled={!newWeight || addWeight.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              <WeightProgressRing
                weightHistory={weightHistory.map((w: any) => ({ weight: Number(w.weight), recorded_at: w.recorded_at }))}
                target={(selectedPaidMember as any)?.target || 'General'}
              />

              {weightHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No weight records yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {weightHistory.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="font-medium">{entry.weight} kg</span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.recorded_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Move className="h-4 w-4" /> Body Measurements
              </CardTitle>
              <Dialog open={addMeasurementOpen} onOpenChange={setAddMeasurementOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Add Body Measurements (inches)</DialogTitle><DialogDescription className="sr-only">Record body measurements in inches</DialogDescription></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    {(['chest', 'waist', 'hips', 'biceps', 'shoulders', 'thighs', 'calves', 'neck'] as const).map(field => (
                      <div key={field}>
                        <Label className="text-xs text-muted-foreground capitalize">{field}</Label>
                        <Input
                          type="number"
                          placeholder="—"
                          value={measurementForm[field]}
                          onChange={(e) => setMeasurementForm(prev => ({ ...prev, [field]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={() => addMeasurement.mutate()}
                    disabled={addMeasurement.isPending || Object.values(measurementForm).every(v => !v)}
                  >
                    Save Measurements
                  </Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {measurements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No measurements recorded yet</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {measurements.map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {format(new Date(m.recorded_at), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => deleteMeasurement.mutate(m.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Chest', value: m.chest },
                          { label: 'Waist', value: m.waist },
                          { label: 'Hips', value: m.hips },
                          { label: 'Biceps', value: m.biceps },
                          { label: 'Shoulders', value: m.shoulders },
                          { label: 'Thighs', value: m.thighs },
                          { label: 'Calves', value: m.calves },
                          { label: 'Neck', value: m.neck },
                        ].filter(item => item.value != null).map(item => (
                          <div key={item.label} className="text-center rounded-md bg-muted/50 p-1.5">
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-semibold">{item.value}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Label (optional)</Label>
                  <Input
                    placeholder="e.g. Week 1, Front view..."
                    value={photoLabel}
                    onChange={(e) => setPhotoLabel(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="relative" asChild>
                  <label className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-1" /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={uploadPhoto}
                    />
                  </label>
                </Button>
              </div>

              {photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-sm">No photos yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo: any) => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border">
                      <img
                        src={photo.photo_url}
                        alt={photo.label || 'Progress'}
                        className="w-full aspect-square object-cover cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setLightboxPhoto({ url: photo.photo_url, label: photo.label || format(new Date(photo.uploaded_at), 'MMM d, yyyy') })}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm p-2">
                        <p className="text-xs font-medium truncate">{photo.label || format(new Date(photo.uploaded_at), 'MMM d')}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePhoto.mutate({ id: photo.id, photo_url: photo.photo_url }); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {lightboxPhoto && (
            <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
              <DialogContent className="max-w-3xl p-2">
                <DialogHeader>
                  <DialogTitle className="text-sm">{lightboxPhoto.label}</DialogTitle>
                  <DialogDescription className="sr-only">View progress photo in full size</DialogDescription>
                </DialogHeader>
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.label}
                  className="w-full max-h-[75vh] object-contain rounded-lg"
                />
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={removeDialogOpen} onOpenChange={(open) => { setRemoveDialogOpen(open); if (!open) setRemoveForm({ updateFee: false, newFee: '' }); }}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" /> Remove from Paid Training
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Remove from Paid Training</DialogTitle><DialogDescription className="sr-only">Remove member from paid training program</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Kya aap <span className="font-semibold text-foreground">{memberData?.full_name}</span> ko paid training se remove karna chahte hain?
                </p>
                {(() => {
                  const member = allMembers.find(m => m.id === (selectedPaidMember as any).member_id);
                  return (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Update Monthly Fee?</Label>
                        <span className="text-xs text-muted-foreground">
                          Current: PKR {member ? Number(member.monthly_fee).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={removeForm.updateFee}
                          onChange={(e) => setRemoveForm({ ...removeForm, updateFee: e.target.checked, newFee: '' })}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">Haan, fee update karo</span>
                      </div>
                      {removeForm.updateFee && (
                        <Input
                          type="number"
                          placeholder="New monthly fee (PKR)"
                          value={removeForm.newFee}
                          onChange={(e) => setRemoveForm({ ...removeForm, newFee: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })()}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate({
                      id: actualMemberId!,
                      updateFee: removeForm.updateFee,
                      newFee: removeForm.newFee,
                      memberId: (selectedPaidMember as any).member_id,
                    })}
                  >
                    {removeMember.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paid Training</h1>
            <p className="text-muted-foreground text-sm">Manage personal training members</p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={availableMembers.length === 0}>
                <UserPlus className="h-4 w-4 mr-1" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add to Paid Training</DialogTitle><DialogDescription className="sr-only">Add member to paid training program</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Member</Label>
                  <Select value={addForm.memberId} onValueChange={(v) => setAddForm({ ...addForm, memberId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a member" /></SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Height</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Feet"
                        value={addForm.heightFt}
                        onChange={(e) => {
                          const ft = e.target.value;
                          setAddForm({ ...addForm, heightFt: ft, height: ftInToCm(ft, addForm.heightIn) });
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ft</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Inches"
                        value={addForm.heightIn}
                        onChange={(e) => {
                          const inches = e.target.value;
                          setAddForm({ ...addForm, heightIn: inches, height: ftInToCm(addForm.heightFt, inches) });
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">in</span>
                    </div>
                  </div>
                  {addForm.height && (
                    <p className="text-xs text-muted-foreground mt-1">≈ {addForm.height} cm</p>
                  )}
                </div>
                <div>
                  <Label>Target</Label>
                  <Select value={addForm.target} onValueChange={(v) => setAddForm({ ...addForm, target: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGETS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trainer (optional)</Label>
                  <Select value={addForm.trainerId || 'none'} onValueChange={(v) => setAddForm({ ...addForm, trainerId: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder={trainers.length ? 'Choose a trainer' : 'No trainers available'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No trainer</SelectItem>
                      {trainers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {trainers.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Add staff with role "Trainer" to assign one.</p>
                  )}
                </div>
                {addForm.memberId && (() => {
                  const selected = allMembers.find(m => m.id === addForm.memberId);
                  return (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Update Monthly Fee?</Label>
                        <span className="text-xs text-muted-foreground">
                          Current: PKR {selected ? Number(selected.monthly_fee).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={addForm.updateFee}
                          onChange={(e) => setAddForm({ ...addForm, updateFee: e.target.checked, newFee: '' })}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">Yes, update fee</span>
                      </div>
                      {addForm.updateFee && (
                        <Input
                          type="number"
                          placeholder="New monthly fee (PKR)"
                          value={addForm.newFee}
                          onChange={(e) => setAddForm({ ...addForm, newFee: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })()}
                <Button
                  className="w-full"
                  onClick={() => addMember.mutate()}
                  disabled={!addForm.memberId || addMember.isPending}
                >
                  Add to Paid Training
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search paid training members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={trainerFilter} onValueChange={setTrainerFilter}>
            <SelectTrigger className="sm:w-56">
              <UserCog className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by trainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trainers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {trainers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : filteredPaid.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserPlus className="h-12 w-12 mx-auto mb-3" />
            <p>{search ? 'No members found' : 'No paid training members yet'}</p>
            <p className="text-sm mt-1">Add existing members to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredPaid.map((pm: any) => {
              const trainerName = trainers.find((t: any) => t.id === pm.trainer_id)?.full_name;
              return (
                <Card
                  key={pm.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedMemberId(pm.id)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground">{pm.members?.full_name}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{pm.target}</Badge>
                        {pm.height && <Badge variant="outline" className="text-xs">{pm.height} cm</Badge>}
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <UserCog className="h-3 w-3" />
                          {trainerName || 'No trainer'}
                        </Badge>
                      </div>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}