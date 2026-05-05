// This file has been removed to eliminate the Recorrentes page from the project.
import { useState } from "react";
import { MainLayout } from "./MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const formatMoney = (value: number) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function RecurringExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    category_id: "",
    start_date: new Date().toISOString().split("T")[0],
  });

        const { data: recurringExpenses = [], isLoading } = useQuery({
          queryKey: ["recurring_expenses_active"],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("recurring_expenses")
              .select(`
                *,
                category:expense_categories(name)
              `)
              .eq("is_active", true)
              .order("start_date", { ascending: false });

            if (error) throw error;
            return data;
          },
        });

        const { data: categories = [] } = useQuery({
          queryKey: ["expense_categories"],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("expense_categories")
              .select("*")
              .order("name");
            if (error) throw error;
            return data;
          },
        });

        const createMutation = useMutation({
          mutationFn: async (data: typeof newExpense) => {
            if (!user) throw new Error("Usuário não identificado");
            // Busca o member_id associado ao user.id
            const { data: memberData } = await supabase
              .from("members")
              .select("id")
              .eq("auth_user_id", user.id)
              .single();

            const { error } = await supabase.from("recurring_expenses").insert({
              member_id: memberData?.id, // Associa ao membro se encontrado
              description: data.description,
              amount: Number(data.amount),
              category_id: data.category_id,
              start_date: data.start_date,
              is_active: true,
              total_installments: null // Recorrente infinita
            });

            if (error) throw error;
          },
          onSuccess: () => {
            toast.success("Despesa recorrente criada com sucesso!");
            setIsDialogOpen(false);
            setNewExpense({
              description: "",
              amount: "",
              category_id: "",
              start_date: new Date().toISOString().split("T")[0],
            });
            queryClient.invalidateQueries({ queryKey: ["recurring_expenses_active"] });
          },
          onError: (error) => {
            toast.error("Erro ao criar despesa: " + error.message);
          },
        });

        const deleteMutation = useMutation({
          mutationFn: async (id: string) => {
            const { error } = await supabase
              .from("recurring_expenses")
              .update({ is_active: false })
              .eq("id", id);

            if (error) throw error;
          },
          onSuccess: () => {
            toast.success("Despesa recorrente removida!");
            queryClient.invalidateQueries({ queryKey: ["recurring_expenses_active"] });
          },
        });

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          if (!newExpense.description || !newExpense.amount || !newExpense.category_id) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
          }
          createMutation.mutate(newExpense);
        };

        return (
          <MainLayout>
            <div className="space-y-6 animate-fade-in p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                    <RotateCcw className="w-8 h-8 text-primary" />
                    Recorrentes
                  </h1>
                  <p className="text-muted-foreground">
                    Gerencie despesas fixas cobradas mensalmente
                  </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Recorrente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Despesa Recorrente</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Input
                          id="description"
                          placeholder="Ex: Netflix, Internet"
                          value={newExpense.description}
                          onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Valor Mensal</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={newExpense.amount}
                          onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={newExpense.category_id} onValueChange={(val) => setNewExpense({ ...newExpense, category_id: val })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {categories.map((cat: any) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Data de Início</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={newExpense.start_date}
                          onChange={(e) => setNewExpense({ ...newExpense, start_date: e.target.value })}
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : recurringExpenses.length === 0 ? (
                <Card className="p-8 text-center bg-muted/20">
                  <div className="flex justify-center mb-4"><RotateCcw className="w-12 h-12 text-muted-foreground/50" /></div>
                  <h3 className="text-lg font-medium text-muted-foreground">Nenhuma despesa recorrente</h3>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {recurringExpenses.map((item: any) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-lg text-foreground">{item.description}</h3>
                            <p className="text-sm text-muted-foreground">{item.category?.name}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 -mt-2 -mr-2" onClick={() => { if (confirm("Excluir recorrência?")) deleteMutation.mutate(item.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex justify-between items-end border-t pt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Valor Mensal</p>
                            <p className="text-xl font-bold text-red-600">{formatMoney(item.amount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Início</p>
                            <p className="text-sm font-medium">{format(new Date(item.start_date), "dd/MM/yyyy")}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </MainLayout>
        );
      }
    </div>
  );
}