'use client'

import { useState, useEffect } from 'react'
import { Plus, Receipt, ArrowDownCircle, DollarSign, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpense, createIncome, getAccounts } from '@/lib/api'
import type { Account } from '@/lib/types'

type Mode = 'expense' | 'income' | null

export default function QuickTransactionFAB() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)

  // Expense form
  const [accountId, setAccountId] = useState('')
  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debit' | 'credit'>('cash')
  const [category, setCategory] = useState('')

  // Income form
  const [incomeDescription, setIncomeDescription] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('')

  useEffect(() => {
    if (open && mode === 'expense') {
      getAccounts().then(setAccounts).catch(console.error)
    }
  }, [open, mode])

  const handleClose = () => {
    setOpen(false)
    setMode(null)
    // Reset forms
    setAccountId('')
    setExpenseName('')
    setExpenseAmount('')
    setCategory('')
    setIncomeDescription('')
    setIncomeAmount('')
    setIncomeCategory('')
  }

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseName || !expenseAmount) return

    setLoading(true)
    try {
      await createExpense({
        account_id: accountId,
        name: expenseName,
        amount: parseFloat(expenseAmount),
        date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        category: category || undefined,
      })
      handleClose()
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Error al registrar gasto')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incomeDescription || !incomeAmount) return

    setLoading(true)
    try {
      await createIncome({
        description: incomeDescription,
        amount: parseFloat(incomeAmount),
        date: new Date().toISOString().split('T')[0],
        category: incomeCategory || undefined,
      })
      handleClose()
      window.location.reload()
    } catch (err) {
      console.error(err)
      alert('Error al registrar ingreso')
    } finally {
      setLoading(false)
    }
  }

  const selectedAccount = accounts.find(a => a.id === accountId)

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/10 shadow-lg transition-all hover:border-white/20 hover:shadow-xl hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label="Agregar transacción"
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white transition-transform group-hover:rotate-90" />
      </button>

      {/* Floating Bubble */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Bubble */}
          <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-md rounded-2xl border border-white/10 bg-[#141414]/95 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
              <h3 className="text-sm font-medium text-white">
                {!mode ? 'Nueva transacción' : mode === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}
              </h3>
              <button
                onClick={handleClose}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Mode Selection */}
              {!mode && (
                <div className="grid gap-2">
                  <button
                    onClick={() => setMode('expense')}
                    className="group flex items-start gap-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 text-left transition-all hover:border-[#FF4444]/50 hover:bg-[#FF4444]/5"
                  >
                    <div className="mt-0.5 rounded-full bg-[#FF4444]/10 p-1.5">
                      <Receipt className="h-4 w-4 text-[#FF4444]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">Gasto</div>
                      <div className="text-xs text-gray-400">Registrar un gasto de hoy</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('income')}
                    className="group flex items-start gap-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3 text-left transition-all hover:border-[#A8FF3E]/50 hover:bg-[#A8FF3E]/5"
                  >
                    <div className="mt-0.5 rounded-full bg-[#A8FF3E]/10 p-1.5">
                      <DollarSign className="h-4 w-4 text-[#A8FF3E]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">Ingreso</div>
                      <div className="text-xs text-gray-400">Dinero que recibiste hoy</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Expense Form */}
              {mode === 'expense' && (
                <form onSubmit={handleSubmitExpense} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="exp-name" className="text-xs text-gray-400">Descripción</Label>
                    <Input
                      id="exp-name"
                      value={expenseName}
                      onChange={e => setExpenseName(e.target.value)}
                      placeholder="Ej: Comida"
                      className="h-9 bg-[#0A0A0A] text-sm"
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="exp-amount" className="text-xs text-gray-400">Monto</Label>
                    <Input
                      id="exp-amount"
                      type="number"
                      step="0.01"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-9 bg-[#0A0A0A] text-sm"
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="payment-method" className="text-xs text-gray-400">Método de pago</Label>
                    <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                      <SelectTrigger id="payment-method" className="h-9 bg-[#0A0A0A] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="debit">Débito</SelectItem>
                        <SelectItem value="credit">Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(paymentMethod === 'debit' || paymentMethod === 'credit') && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="account" className="text-xs text-gray-400">
                        {paymentMethod === 'credit' ? 'Tarjeta' : 'Cuenta'}
                      </Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger id="account" className="h-9 bg-[#0A0A0A] text-sm">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter(a =>
                              paymentMethod === 'credit'
                                ? a.account_type === 'credit_card'
                                : a.account_type !== 'credit_card'
                            )
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-1.5">
                    <Label htmlFor="category" className="text-xs text-gray-400">Categoría (opcional)</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="Ej: Alimentación"
                      className="h-9 bg-[#0A0A0A] text-sm"
                    />
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMode(null)}
                      className="flex-1 h-9 text-xs"
                    >
                      Atrás
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !expenseName || !expenseAmount || ((paymentMethod !== 'cash') && !accountId)}
                      className="flex-1 h-9 bg-white text-black hover:bg-white/90 text-xs font-medium"
                    >
                      {loading ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Income Form */}
              {mode === 'income' && (
                <form onSubmit={handleSubmitIncome} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="inc-desc" className="text-xs text-gray-400">Descripción</Label>
                    <Input
                      id="inc-desc"
                      value={incomeDescription}
                      onChange={e => setIncomeDescription(e.target.value)}
                      placeholder="Ej: Freelance, Regalo, etc."
                      className="h-9 bg-[#0A0A0A] text-sm"
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="inc-amount" className="text-xs text-gray-400">Monto</Label>
                    <Input
                      id="inc-amount"
                      type="number"
                      step="0.01"
                      value={incomeAmount}
                      onChange={e => setIncomeAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-9 bg-[#0A0A0A] text-sm"
                      required
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="inc-category" className="text-xs text-gray-400">Categoría (opcional)</Label>
                    <Input
                      id="inc-category"
                      value={incomeCategory}
                      onChange={e => setIncomeCategory(e.target.value)}
                      placeholder="Ej: Extra, Bono, etc."
                      className="h-9 bg-[#0A0A0A] text-sm"
                    />
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMode(null)}
                      className="flex-1 h-9 text-xs"
                    >
                      Atrás
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !incomeDescription || !incomeAmount}
                      className="flex-1 h-9 bg-white text-black hover:bg-white/90 text-xs font-medium"
                    >
                      {loading ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
