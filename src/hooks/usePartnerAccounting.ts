import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface PartnerDraw {
  id: string;
  partner_name: string;
  amount: number;
  draw_date: string;
  notes: string | null;
  created_at: string;
}

export interface BusinessDebt {
  id: string;
  creditor_name: string;
  description: string | null;
  original_amount: number;
  current_balance: number;
  due_date: string | null;
  is_paid_off: boolean;
  notes: string | null;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface PartnerSettings {
  partner1_name: string;
  partner2_name: string;
  max_draw_percentage: number;
  profit_split_percentage: number;
}

// Type-safe wrapper for tables not yet in generated types
const fromTable = (table: string) => {
  return (supabase as any).from(table);
};

// Hook for partner draws
export function usePartnerDraws() {
  const [draws, setDraws] = useState<PartnerDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDraws = async () => {
    try {
      const { data, error } = await fromTable('partner_draws')
        .select('*')
        .order('draw_date', { ascending: false });

      if (error) throw error;
      setDraws((data || []) as PartnerDraw[]);
    } catch (error: any) {
      console.error('Error fetching draws:', error);
      toast({
        title: "Error",
        description: "Failed to load partner draws",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraws();
  }, []);

  const addDraw = async (draw: Omit<PartnerDraw, 'id' | 'created_at'>) => {
    try {
      const { error } = await fromTable('partner_draws')
        .insert([draw]);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Draw recorded successfully"
      });
      
      fetchDraws();
      return true;
    } catch (error: any) {
      console.error('Error adding draw:', error);
      toast({
        title: "Error",
        description: "Failed to record draw",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteDraw = async (id: string) => {
    try {
      const { error } = await fromTable('partner_draws')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Draw deleted"
      });
      
      fetchDraws();
      return true;
    } catch (error: any) {
      console.error('Error deleting draw:', error);
      toast({
        title: "Error",
        description: "Failed to delete draw",
        variant: "destructive"
      });
      return false;
    }
  };

  return { draws, loading, addDraw, deleteDraw, refetch: fetchDraws };
}

// Hook for business debts
export function useBusinessDebts() {
  const [debts, setDebts] = useState<BusinessDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDebts = async () => {
    try {
      const { data, error } = await fromTable('business_debts')
        .select('*')
        .order('is_paid_off', { ascending: true })
        .order('due_date', { ascending: true });

      if (error) throw error;
      setDebts((data || []) as BusinessDebt[]);
    } catch (error: any) {
      console.error('Error fetching debts:', error);
      toast({
        title: "Error",
        description: "Failed to load debts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const addDebt = async (debt: Omit<BusinessDebt, 'id' | 'created_at' | 'is_paid_off'>) => {
    try {
      const { error } = await fromTable('business_debts')
        .insert([{ ...debt, is_paid_off: false }]);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Debt added successfully"
      });
      
      fetchDebts();
      return true;
    } catch (error: any) {
      console.error('Error adding debt:', error);
      toast({
        title: "Error",
        description: "Failed to add debt",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateDebt = async (id: string, updates: Partial<BusinessDebt>) => {
    try {
      const { error } = await fromTable('business_debts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Debt updated"
      });
      
      fetchDebts();
      return true;
    } catch (error: any) {
      console.error('Error updating debt:', error);
      toast({
        title: "Error",
        description: "Failed to update debt",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteDebt = async (id: string) => {
    try {
      const { error } = await fromTable('business_debts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Debt deleted"
      });
      
      fetchDebts();
      return true;
    } catch (error: any) {
      console.error('Error deleting debt:', error);
      toast({
        title: "Error",
        description: "Failed to delete debt",
        variant: "destructive"
      });
      return false;
    }
  };

  return { debts, loading, addDebt, updateDebt, deleteDebt, refetch: fetchDebts };
}

// Hook for debt payments
export function useDebtPayments(debtId?: string) {
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPayments = async () => {
    try {
      let query = fromTable('debt_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (debtId) {
        query = query.eq('debt_id', debtId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments((data || []) as DebtPayment[]);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [debtId]);

  const addPayment = async (payment: Omit<DebtPayment, 'id' | 'created_at'>, currentBalance: number) => {
    try {
      // Add the payment
      const { error: paymentError } = await fromTable('debt_payments')
        .insert([payment]);

      if (paymentError) throw paymentError;

      // Update the debt balance
      const newBalance = currentBalance - payment.amount;
      const { error: debtError } = await fromTable('business_debts')
        .update({ 
          current_balance: newBalance,
          is_paid_off: newBalance <= 0
        })
        .eq('id', payment.debt_id);

      if (debtError) throw debtError;
      
      toast({
        title: "Success",
        description: "Payment recorded"
      });
      
      fetchPayments();
      return true;
    } catch (error: any) {
      console.error('Error adding payment:', error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive"
      });
      return false;
    }
  };

  const deletePayment = async (paymentId: string, debtId: string, amount: number, currentBalance: number) => {
    try {
      // Delete the payment
      const { error: paymentError } = await fromTable('debt_payments')
        .delete()
        .eq('id', paymentId);

      if (paymentError) throw paymentError;

      // Update the debt balance (add back the payment amount)
      const newBalance = currentBalance + amount;
      const { error: debtError } = await fromTable('business_debts')
        .update({ 
          current_balance: newBalance,
          is_paid_off: false
        })
        .eq('id', debtId);

      if (debtError) throw debtError;
      
      toast({
        title: "Success",
        description: "Payment deleted"
      });
      
      fetchPayments();
      return true;
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Error",
        description: "Failed to delete payment",
        variant: "destructive"
      });
      return false;
    }
  };

  return { payments, loading, addPayment, deletePayment, refetch: fetchPayments };
}

// Hook for partner settings
export function usePartnerSettings() {
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .single();

      if (error) throw error;
      
      // Extract partner-specific settings with defaults
      const partnerSettings: PartnerSettings = {
        partner1_name: (data as any).partner1_name || 'Partner 1',
        partner2_name: (data as any).partner2_name || 'Partner 2',
        max_draw_percentage: (data as any).max_draw_percentage || 10,
        profit_split_percentage: (data as any).profit_split_percentage || 50
      };
      
      setSettings(partnerSettings);
    } catch (error: any) {
      console.error('Error fetching partner settings:', error);
      // Set defaults if not found
      setSettings({
        partner1_name: 'Partner 1',
        partner2_name: 'Partner 2',
        max_draw_percentage: 10,
        profit_split_percentage: 50
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (updates: Partial<PartnerSettings>) => {
    try {
      const { data: currentSettings } = await supabase
        .from('global_settings')
        .select('id')
        .single();
      
      if (!currentSettings) throw new Error('No settings found');

      const { error } = await supabase
        .from('global_settings')
        .update(updates as any)
        .eq('id', currentSettings.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Settings updated"
      });
      
      fetchSettings();
      return true;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
      return false;
    }
  };

  return { settings, loading, updateSettings, refetch: fetchSettings };
}

// Hook for calculating partner draws summary
export function usePartnerDrawsSummary(year: number, month: number) {
  const [summary, setSummary] = useState<{
    partner1Total: number;
    partner2Total: number;
    totalDraws: number;
  }>({ partner1Total: 0, partner2Total: 0, totalDraws: 0 });
  const [loading, setLoading] = useState(true);
  const { settings } = usePartnerSettings();

  useEffect(() => {
    const fetchSummary = async () => {
      if (!settings) return;
      
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const { data, error } = await fromTable('partner_draws')
          .select('partner_name, amount')
          .gte('draw_date', startDate)
          .lte('draw_date', endDate);

        if (error) throw error;

        const draws = (data || []) as PartnerDraw[];
        
        const partner1Total = draws
          .filter(d => d.partner_name === settings.partner1_name)
          .reduce((sum, d) => sum + Number(d.amount), 0);

        const partner2Total = draws
          .filter(d => d.partner_name === settings.partner2_name)
          .reduce((sum, d) => sum + Number(d.amount), 0);

        setSummary({
          partner1Total,
          partner2Total,
          totalDraws: partner1Total + partner2Total
        });
      } catch (error: any) {
        console.error('Error fetching draws summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [year, month, settings]);

  return { summary, loading };
}
