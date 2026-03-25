import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  DollarSign, 
  Users, 
  CreditCard, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Settings,
  TrendingDown,
  Wallet
} from "lucide-react";
import { 
  usePartnerDraws, 
  useBusinessDebts, 
  useDebtPayments, 
  usePartnerSettings,
  BusinessDebt 
} from "@/hooks/usePartnerAccounting";
import { useFinancialSummary } from "@/hooks/useBalances";
import { format } from "date-fns";

export default function PartnerAccounting() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partner Accounting</h1>
          <p className="text-muted-foreground">Manage partner draws and business debts</p>
        </div>
        <SettingsDialog />
      </div>

      <Tabs defaultValue="draws" className="space-y-4">
        <TabsList>
          <TabsTrigger value="draws" className="gap-2">
            <Users className="h-4 w-4" />
            Partner Draws
          </TabsTrigger>
          <TabsTrigger value="debts" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Business Debts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draws">
          <PartnerDrawsTab 
            year={selectedYear} 
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
        </TabsContent>

        <TabsContent value="debts">
          <BusinessDebtsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Settings Dialog
function SettingsDialog() {
  const { settings, updateSettings } = usePartnerSettings();
  const [open, setOpen] = useState(false);
  const [partner1Name, setPartner1Name] = useState("");
  const [partner2Name, setPartner2Name] = useState("");
  const [maxDrawPercentage, setMaxDrawPercentage] = useState("");
  const [profitSplitPercentage, setProfitSplitPercentage] = useState("");

  const handleOpen = () => {
    if (settings) {
      setPartner1Name(settings.partner1_name);
      setPartner2Name(settings.partner2_name);
      setMaxDrawPercentage(settings.max_draw_percentage.toString());
      setProfitSplitPercentage(settings.profit_split_percentage.toString());
    }
    setOpen(true);
  };

  const handleSave = async () => {
    await updateSettings({
      partner1_name: partner1Name,
      partner2_name: partner2Name,
      max_draw_percentage: parseFloat(maxDrawPercentage),
      profit_split_percentage: parseFloat(profitSplitPercentage)
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleOpen}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partner Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Partner 1 Name</Label>
              <Input 
                value={partner1Name} 
                onChange={e => setPartner1Name(e.target.value)}
                placeholder="Partner 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Partner 2 Name</Label>
              <Input 
                value={partner2Name} 
                onChange={e => setPartner2Name(e.target.value)}
                placeholder="Partner 2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Draw % of Profit</Label>
              <Input 
                type="number"
                value={maxDrawPercentage} 
                onChange={e => setMaxDrawPercentage(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label>Profit Split % (Partner 1)</Label>
              <Input 
                type="number"
                value={profitSplitPercentage} 
                onChange={e => setProfitSplitPercentage(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                Partner 2 gets {100 - (parseFloat(profitSplitPercentage) || 50)}%
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Partner Draws Tab
function PartnerDrawsTab({ 
  year, 
  month,
  onYearChange,
  onMonthChange
}: { 
  year: number; 
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}) {
  const { draws, loading, addDraw, deleteDraw } = usePartnerDraws();
  const { settings } = usePartnerSettings();
  const { data: financialSummary, isLoading: financialLoading } = useFinancialSummary(year, month);
  const [addDrawOpen, setAddDrawOpen] = useState(false);
  const [newDraw, setNewDraw] = useState({
    partner_name: "",
    amount: "",
    draw_date: format(new Date(), "yyyy-MM-dd"),
    notes: ""
  });

  // Filter draws for selected month
  const monthDraws = draws.filter(d => {
    const drawDate = new Date(d.draw_date);
    return drawDate.getFullYear() === year && drawDate.getMonth() + 1 === month;
  });

  // Calculate totals per partner
  const partner1Total = monthDraws
    .filter(d => d.partner_name === settings?.partner1_name)
    .reduce((sum, d) => sum + Number(d.amount), 0);
  
  const partner2Total = monthDraws
    .filter(d => d.partner_name === settings?.partner2_name)
    .reduce((sum, d) => sum + Number(d.amount), 0);

  // Calculate available draws based on profit (netProfit from financials)
  const monthlyProfit = financialSummary?.netProfit || 0;
  const maxDrawAmount = monthlyProfit * ((settings?.max_draw_percentage || 10) / 100);
  const partner1MaxDraw = maxDrawAmount * ((settings?.profit_split_percentage || 50) / 100);
  const partner2MaxDraw = maxDrawAmount * ((100 - (settings?.profit_split_percentage || 50)) / 100);

  const handleAddDraw = async () => {
    if (!newDraw.partner_name || !newDraw.amount) return;
    
    await addDraw({
      partner_name: newDraw.partner_name,
      amount: parseFloat(newDraw.amount),
      draw_date: newDraw.draw_date,
      notes: newDraw.notes || null
    });
    
    setAddDrawOpen(false);
    setNewDraw({
      partner_name: "",
      amount: "",
      draw_date: format(new Date(), "yyyy-MM-dd"),
      notes: ""
    });
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <div className="flex items-center gap-4">
        <Select value={month.toString()} onValueChange={v => onMonthChange(parseInt(v))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year.toString()} onValueChange={v => onYearChange(parseInt(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Monthly Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Max draw: ${maxDrawAmount.toFixed(2)} ({settings?.max_draw_percentage}%)
            </p>
          </CardContent>
        </Card>

        <Card className={partner1Total > partner1MaxDraw ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{settings?.partner1_name || "Partner 1"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${partner1Total.toFixed(2)}</div>
            <Progress 
              value={partner1MaxDraw > 0 ? (partner1Total / partner1MaxDraw) * 100 : 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max: ${partner1MaxDraw.toFixed(2)} | Remaining: ${Math.max(0, partner1MaxDraw - partner1Total).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className={partner2Total > partner2MaxDraw ? "border-red-500" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{settings?.partner2_name || "Partner 2"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${partner2Total.toFixed(2)}</div>
            <Progress 
              value={partner2MaxDraw > 0 ? (partner2Total / partner2MaxDraw) * 100 : 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max: ${partner2MaxDraw.toFixed(2)} | Remaining: ${Math.max(0, partner2MaxDraw - partner2Total).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Draw Button */}
      <Dialog open={addDrawOpen} onOpenChange={setAddDrawOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Record Draw
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Partner Draw</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner</Label>
              <Select 
                value={newDraw.partner_name} 
                onValueChange={v => setNewDraw({...newDraw, partner_name: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={settings?.partner1_name || "Partner 1"}>
                    {settings?.partner1_name || "Partner 1"}
                  </SelectItem>
                  <SelectItem value={settings?.partner2_name || "Partner 2"}>
                    {settings?.partner2_name || "Partner 2"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input 
                type="number" 
                value={newDraw.amount}
                onChange={e => setNewDraw({...newDraw, amount: e.target.value})}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={newDraw.draw_date}
                onChange={e => setNewDraw({...newDraw, draw_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea 
                value={newDraw.notes}
                onChange={e => setNewDraw({...newDraw, notes: e.target.value})}
                placeholder="Notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDrawOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDraw}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draws List */}
      <Card>
        <CardHeader>
          <CardTitle>Draws This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : monthDraws.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No draws recorded this month</p>
          ) : (
            <div className="space-y-2">
              {monthDraws.map(draw => (
                <div key={draw.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{draw.partner_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(draw.draw_date), "MMM d, yyyy")}
                        {draw.notes && ` • ${draw.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">${Number(draw.amount).toFixed(2)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteDraw(draw.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Draws History */}
      <Card>
        <CardHeader>
          <CardTitle>All Draws History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : draws.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No draws recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {draws.map(draw => (
                <div key={draw.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{draw.partner_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(draw.draw_date), "MMM d, yyyy")}
                        {draw.notes && ` • ${draw.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">${Number(draw.amount).toFixed(2)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteDraw(draw.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Business Debts Tab
function BusinessDebtsTab() {
  const { debts, loading, addDebt, updateDebt, deleteDebt } = useBusinessDebts();
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<BusinessDebt | null>(null);
  const [newDebt, setNewDebt] = useState({
    creditor_name: "",
    description: "",
    original_amount: "",
    current_balance: "",
    due_date: "",
    notes: ""
  });

  const totalDebt = debts.filter(d => !d.is_paid_off).reduce((sum, d) => sum + Number(d.current_balance), 0);
  const paidOffDebts = debts.filter(d => d.is_paid_off).length;
  const activeDebts = debts.filter(d => !d.is_paid_off).length;

  const handleAddDebt = async () => {
    if (!newDebt.creditor_name || !newDebt.original_amount) return;
    
    const amount = parseFloat(newDebt.original_amount);
    await addDebt({
      creditor_name: newDebt.creditor_name,
      description: newDebt.description || null,
      original_amount: amount,
      current_balance: newDebt.current_balance ? parseFloat(newDebt.current_balance) : amount,
      due_date: newDebt.due_date || null,
      notes: newDebt.notes || null
    });
    
    setAddDebtOpen(false);
    setNewDebt({
      creditor_name: "",
      description: "",
      original_amount: "",
      current_balance: "",
      due_date: "",
      notes: ""
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalDebt.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Active Debts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDebts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Paid Off
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidOffDebts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Debt Button */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Debt
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Business Debt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Creditor Name</Label>
              <Input 
                value={newDebt.creditor_name}
                onChange={e => setNewDebt({...newDebt, creditor_name: e.target.value})}
                placeholder="Who do you owe?"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={newDebt.description}
                onChange={e => setNewDebt({...newDebt, description: e.target.value})}
                placeholder="What is this debt for?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Original Amount</Label>
                <Input 
                  type="number"
                  value={newDebt.original_amount}
                  onChange={e => setNewDebt({...newDebt, original_amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Current Balance</Label>
                <Input 
                  type="number"
                  value={newDebt.current_balance}
                  onChange={e => setNewDebt({...newDebt, current_balance: e.target.value})}
                  placeholder="Same as original if blank"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input 
                type="date"
                value={newDebt.due_date}
                onChange={e => setNewDebt({...newDebt, due_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea 
                value={newDebt.notes}
                onChange={e => setNewDebt({...newDebt, notes: e.target.value})}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDebtOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDebt}>Add Debt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Debts */}
      <Card>
        <CardHeader>
          <CardTitle>Active Debts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : debts.filter(d => !d.is_paid_off).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active debts 🎉</p>
          ) : (
            <div className="space-y-4">
              {debts.filter(d => !d.is_paid_off).map(debt => (
                <DebtCard 
                  key={debt.id} 
                  debt={debt} 
                  onPayment={() => setSelectedDebt(debt)}
                  onDelete={() => deleteDebt(debt.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid Off Debts */}
      {debts.filter(d => d.is_paid_off).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paid Off Debts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {debts.filter(d => d.is_paid_off).map(debt => (
                <DebtCard 
                  key={debt.id} 
                  debt={debt} 
                  onPayment={() => setSelectedDebt(debt)}
                  onDelete={() => deleteDebt(debt.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      {selectedDebt && (
        <DebtPaymentDialog 
          debt={selectedDebt} 
          open={!!selectedDebt} 
          onClose={() => setSelectedDebt(null)} 
        />
      )}
    </div>
  );
}

// Debt Card Component
function DebtCard({ 
  debt, 
  onPayment, 
  onDelete 
}: { 
  debt: BusinessDebt; 
  onPayment: () => void;
  onDelete: () => void;
}) {
  const progress = ((debt.original_amount - debt.current_balance) / debt.original_amount) * 100;
  const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && !debt.is_paid_off;

  return (
    <div className={`p-4 border rounded-lg ${debt.is_paid_off ? 'bg-green-50 border-green-200' : isOverdue ? 'border-red-300 bg-red-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{debt.creditor_name}</h3>
            {debt.is_paid_off && (
              <Badge variant="outline" className="bg-green-100 text-green-800">Paid Off</Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive">Overdue</Badge>
            )}
          </div>
          {debt.description && (
            <p className="text-sm text-muted-foreground">{debt.description}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">${Number(debt.current_balance).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">of ${Number(debt.original_amount).toFixed(2)}</p>
        </div>
      </div>
      
      <Progress value={progress} className="h-2 mb-2" />
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 text-muted-foreground">
          {debt.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due: {format(new Date(debt.due_date), "MMM d, yyyy")}
            </span>
          )}
          {debt.notes && <span>{debt.notes}</span>}
        </div>
        <div className="flex items-center gap-2">
          {!debt.is_paid_off && (
            <Button size="sm" onClick={onPayment}>
              <DollarSign className="h-3 w-3 mr-1" />
              Record Payment
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Debt Payment Dialog
function DebtPaymentDialog({ 
  debt, 
  open, 
  onClose 
}: { 
  debt: BusinessDebt; 
  open: boolean; 
  onClose: () => void;
}) {
  const { payments, addPayment, deletePayment, refetch } = useDebtPayments(debt.id);
  const { refetch: refetchDebts } = useBusinessDebts();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");

  const handleAddPayment = async () => {
    if (!amount) return;
    
    const success = await addPayment({
      debt_id: debt.id,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod || null,
      notes: notes || null
    }, Number(debt.current_balance));
    
    if (success) {
      setAmount("");
      setPaymentMethod("");
      setNotes("");
      refetchDebts();
    }
  };

  const handleDeletePayment = async (paymentId: string, paymentAmount: number) => {
    await deletePayment(paymentId, debt.id, paymentAmount, Number(debt.current_balance));
    refetchDebts();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payments for {debt.creditor_name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Add Payment Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Record Payment</h3>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method (optional)</Label>
              <Input 
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                placeholder="Cash, Check, Transfer..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes..."
              />
            </div>
            <Button onClick={handleAddPayment} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>

          {/* Payment History */}
          <div>
            <h3 className="font-semibold mb-4">Payment History</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No payments yet</p>
              ) : (
                payments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">${Number(payment.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.payment_date), "MMM d, yyyy")}
                        {payment.payment_method && ` • ${payment.payment_method}`}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeletePayment(payment.id, Number(payment.amount))}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
