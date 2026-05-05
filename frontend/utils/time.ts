export const isPastGame = (scheduledTime: string | null): boolean => {
  if (!scheduledTime) return false;
  const d = new Date(scheduledTime);
  return !isNaN(d.getTime()) && d < new Date();
};

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatChatTimestamp = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
