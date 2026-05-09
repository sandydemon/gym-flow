-- Enable realtime for gyms table to support live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.gyms;