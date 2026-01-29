import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Clock,
  User,
  Search,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { useCallLogs, useClickToCall, useUpdateCallLog } from '@/hooks/useCallLogs';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';

export default function CallLogs() {
  const [search, setSearch] = useState('');
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: callLogs, isLoading, refetch } = useCallLogs(100);
  const clickToCall = useClickToCall();
  const updateCallLog = useUpdateCallLog();

  const filteredLogs = callLogs?.filter(log => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.customer_name?.toLowerCase().includes(searchLower) ||
      log.phone_number?.includes(search)
    );
  });

  const handleCallBack = (log: any) => {
    clickToCall.mutate({
      phone_number: log.phone_number,
      customer_id: log.customer_id,
      customer_name: log.customer_name,
    });
  };

  const handleSaveNotes = async () => {
    if (!selectedCall) return;
    await updateCallLog.mutateAsync({ id: selectedCall.id, notes });
    setSelectedCall(null);
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'missed':
      case 'no_answer':
        return <Badge variant="destructive">Missed</Badge>;
      case 'busy':
        return <Badge variant="secondary">Busy</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
      case 'ringing':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Ringing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDirectionIcon = (direction: string, status: string) => {
    if (status === 'missed' || status === 'no_answer') {
      return <PhoneMissed className="w-5 h-5 text-red-500" />;
    }
    return direction === 'inbound' 
      ? <PhoneIncoming className="w-5 h-5 text-green-500" />
      : <PhoneOutgoing className="w-5 h-5 text-blue-500" />;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <AppLayout 
      title="Call Logs" 
      subtitle="View and manage your call history"
      actions={
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6 animate-fade-in">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Call Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-2xl font-bold">{callLogs?.length || 0}</p>
                </div>
                <Phone className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Incoming</p>
                  <p className="text-2xl font-bold text-green-600">
                    {callLogs?.filter(l => l.direction === 'inbound').length || 0}
                  </p>
                </div>
                <PhoneIncoming className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outgoing</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {callLogs?.filter(l => l.direction === 'outbound').length || 0}
                  </p>
                </div>
                <PhoneOutgoing className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {callLogs?.filter(l => l.status === 'missed' || l.status === 'no_answer').length || 0}
                  </p>
                </div>
                <PhoneMissed className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading call logs...</div>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="shadow-soft hover:shadow-card transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {getDirectionIcon(log.direction, log.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">
                            {log.customer_name || 'Unknown Caller'}
                          </h3>
                          {getStatusBadge(log.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{log.phone_number}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                          {log.duration_seconds && (
                            <span>Duration: {formatDuration(log.duration_seconds)}</span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{log.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCall(log);
                          setNotes(log.notes || '');
                        }}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Notes
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCallBack(log)}
                        disabled={clickToCall.isPending}
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        {log.direction === 'inbound' ? 'Call Back' : 'Call Again'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Phone className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No call logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Incoming and outgoing calls will appear here
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call Notes</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedCall.customer_name || 'Unknown Caller'}</p>
                  <p className="text-sm text-muted-foreground">{selectedCall.phone_number}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this call..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedCall(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveNotes}
                  disabled={updateCallLog.isPending}
                >
                  {updateCallLog.isPending ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
