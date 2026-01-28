import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Receipt,
  Plus,
  Calendar,
  PieChart,
  BarChart3,
  FileText,
  Download
} from 'lucide-react';
import { useFinancialSummary, useExpenses, useCreateExpense, useBookProfitability } from '@/hooks/useBalances';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Expense, ExpenseCategory } from '@/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'other', label: 'Other' },
];

export default function Financials() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(currentMonth);
  
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(selectedYear, selectedMonth);
  const { data: expenses } = useExpenses({ 
    startDate: selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01` : `${selectedYear}-01-01`,
    endDate: selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31` : `${selectedYear}-12-31`,
  });
  const { data: bookProfits } = useBookProfitability(
    selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01` : `${selectedYear}-01-01`,
    selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31` : `${selectedYear}-12-31`
  );
  const createExpense = useCreateExpense();
  
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'other' as ExpenseCategory,
    description: '',
    amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    is_tax_deductible: true,
    notes: '',
  });

  const handleAddExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Please fill in required fields');
      return;
    }
    
    await createExpense.mutateAsync({
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      expense_date: expenseForm.expense_date,
      is_tax_deductible: expenseForm.is_tax_deductible,
      notes: expenseForm.notes || null,
      receipt_url: null,
    });
    
    setExpenseDialog(false);
    setExpenseForm({
      category: 'other',
      description: '',
      amount: '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      is_tax_deductible: true,
      notes: '',
    });
  };

  const generateReport = () => {
    if (!summary) return;
    
    const reportData = {
      period: selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : `${selectedYear}`,
      revenue: summary.revenue,
      cost: summary.cost,
      grossProfit: summary.grossProfit,
      expenses: summary.totalExpenses,
      netProfit: summary.netProfit,
      taxDeductible: summary.taxDeductibleExpenses,
      expensesByCategory: summary.expensesByCategory,
      bookProfits: bookProfits?.slice(0, 10),
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${reportData.period}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  return (
    <AppLayout 
      title="Financials" 
      subtitle="Track revenue, expenses, and profitability"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Period Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Year:</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Month:</Label>
            <Select
              value={selectedMonth?.toString() || 'all'}
              onValueChange={(value) => setSelectedMonth(value === 'all' ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Year</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {format(new Date(2024, i), 'MMMM')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={generateReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={() => setExpenseDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${summary?.revenue.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Book Costs</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${summary?.cost.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${summary?.totalExpenses.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-card ${(summary?.netProfit || 0) >= 0 ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${(summary?.netProfit || 0) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <DollarSign className={`w-6 h-6 ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold ${(summary?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${summary?.netProfit.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tax Info */}
        <Card className="shadow-card border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-700">Tax Deductible Expenses</p>
                <p className="text-sm text-blue-600">
                  ${summary?.taxDeductibleExpenses.toFixed(2) || '0.00'} of your expenses are marked as tax deductible
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="expenses" className="w-full">
          <TabsList>
            <TabsTrigger value="expenses">
              Expenses
              {(expenses?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">{expenses?.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="by-category">
              By Category
            </TabsTrigger>
            <TabsTrigger value="by-book">
              By Book
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Expense Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expenses && expenses.length > 0 ? (
                  <div className="space-y-2">
                    {expenses.map((expense) => (
                      <div 
                        key={expense.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(expense.expense_date), 'MMM d, yyyy')}
                              <Badge variant="outline" className="ml-2">{expense.category}</Badge>
                              {expense.is_tax_deductible && (
                                <Badge variant="secondary" className="ml-1 bg-blue-500/10 text-blue-600">Tax Ded.</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-orange-600">-${expense.amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No expenses recorded for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-category" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Expenses by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.expensesByCategory && Object.keys(summary.expensesByCategory).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(summary.expensesByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([category, amount]) => (
                        <div 
                          key={category}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize">{category}</Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-32 bg-secondary rounded-full h-2">
                              <div 
                                className="bg-orange-500 h-2 rounded-full"
                                style={{ 
                                  width: `${Math.min(100, (amount / summary.totalExpenses) * 100)}%` 
                                }}
                              />
                            </div>
                            <p className="font-bold w-24 text-right">${amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No expense data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-book" className="mt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Profit by Book
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookProfits && bookProfits.length > 0 ? (
                  <div className="space-y-2">
                    {bookProfits.map((book) => (
                      <div 
                        key={book.bookId}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div>
                          <p className="font-medium">{book.bookTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {book.totalQuantity} sold • Revenue: ${book.totalRevenue.toFixed(2)} • Cost: ${book.totalCost.toFixed(2)}
                          </p>
                        </div>
                        <p className={`font-bold ${book.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${book.profit.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No sales data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>
              Record a business expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(value: ExpenseCategory) => setExpenseForm({ ...expenseForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="What was this expense for?"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tax"
                checked={expenseForm.is_tax_deductible}
                onCheckedChange={(checked) => setExpenseForm({ ...expenseForm, is_tax_deductible: !!checked })}
              />
              <Label htmlFor="tax" className="cursor-pointer">Tax Deductible</Label>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExpense} disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Adding...' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
