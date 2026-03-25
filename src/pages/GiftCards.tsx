import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gift, PlusCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';

type GiftTransactionType = 'load' | 'redeem' | 'adjustment';

interface GiftCard {
  id: string;
  card_number: string;
  holder_name: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
}

interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  transaction_type: GiftTransactionType;
  amount: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  gift_card?: GiftCard;
}

const generateCardNumber = () => `GC-${Date.now().toString().slice(-8)}`;

export default function GiftCards() {
  const queryClient = useQueryClient();

  const [newCardNumber, setNewCardNumber] = useState(generateCardNumber());
  const [newHolderName, setNewHolderName] = useState('');

  const [selectedGiftCardId, setSelectedGiftCardId] = useState('');
  const [transactionType, setTransactionType] = useState<GiftTransactionType>('load');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['gift-cards'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('gift_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GiftCard[];
    },
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['gift-card-transactions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('gift_card_transactions')
        .select('*, gift_card:gift_cards(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as GiftCardTransaction[];
    },
  });

  const createCard = useMutation({
    mutationFn: async () => {
      if (!newCardNumber.trim()) throw new Error('Card number is required');

      const { error } = await (supabase as any)
        .from('gift_cards')
        .insert({
          card_number: newCardNumber.trim(),
          holder_name: newHolderName.trim() || null,
          balance: 0,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      setNewHolderName('');
      setNewCardNumber(generateCardNumber());
      toast.success('Gift card created');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create gift card'),
  });

  const addTransaction = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(transactionAmount);
      if (!selectedGiftCardId) throw new Error('Please select a gift card');
      if (!amount || amount <= 0) throw new Error('Amount must be greater than 0');

      if (transactionType === 'redeem') {
        const selectedCard = cards?.find((c) => c.id === selectedGiftCardId);
        if (!selectedCard) throw new Error('Gift card not found');
        if (amount > (selectedCard.balance || 0)) {
          throw new Error('Not enough card balance');
        }
      }

      const { error } = await (supabase as any)
        .from('gift_card_transactions')
        .insert({
          gift_card_id: selectedGiftCardId,
          transaction_type: transactionType,
          amount,
          reference: transactionReference.trim() || null,
          notes: transactionNotes.trim() || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift-card-transactions'] });
      setTransactionAmount('');
      setTransactionReference('');
      setTransactionNotes('');
      toast.success('Gift card transaction saved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to save transaction'),
  });

  return (
    <AppLayout title="Gift Cards" subtitle="Track balances by card number">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                Create Gift Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input value={newCardNumber} onChange={(e) => setNewCardNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Holder Name (optional)</Label>
                <Input value={newHolderName} onChange={(e) => setNewHolderName(e.target.value)} placeholder="Name" />
              </div>
              <Button onClick={() => createCard.mutate()} disabled={createCard.isPending}>
                {createCard.isPending ? 'Creating...' : 'Create Card'}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Add Transaction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Gift Card</Label>
                <Select value={selectedGiftCardId} onValueChange={setSelectedGiftCardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select card" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cards || []).map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.card_number} • ${Number(card.balance || 0).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={transactionType} onValueChange={(v: GiftTransactionType) => setTransactionType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="load">Load</SelectItem>
                      <SelectItem value="redeem">Redeem</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" min="0" step="0.01" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="e.g. Bar Mitzvah Gift" />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input value={transactionNotes} onChange={(e) => setTransactionNotes(e.target.value)} placeholder="Notes" />
              </div>

              <Button onClick={() => addTransaction.mutate()} disabled={addTransaction.isPending}>
                {addTransaction.isPending ? 'Saving...' : 'Save Transaction'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Gift Cards</CardTitle>
          </CardHeader>
          <CardContent>
            {cardsLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : cards && cards.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Card Number</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.card_number}</TableCell>
                      <TableCell>{card.holder_name || '-'}</TableCell>
                      <TableCell>${Number(card.balance || 0).toFixed(2)}</TableCell>
                      <TableCell>{card.is_active ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell>{format(new Date(card.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No gift cards yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : transactions && transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell>{tx.gift_card?.card_number || '-'}</TableCell>
                      <TableCell className="capitalize flex items-center gap-2">
                        {tx.transaction_type === 'redeem' ? <ArrowDownCircle className="w-4 h-4 text-red-500" /> : <ArrowUpCircle className="w-4 h-4 text-green-500" />}
                        {tx.transaction_type}
                      </TableCell>
                      <TableCell>${Number(tx.amount).toFixed(2)}</TableCell>
                      <TableCell>{tx.reference || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No transactions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
