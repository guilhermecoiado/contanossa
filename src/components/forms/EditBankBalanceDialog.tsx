import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const schema = z.object({
  balance: z.number({ invalid_type_error: 'Informe um valor válido' })
});

type EditBankBalanceDialogProps = {
  bank: {
    id: string;
    name: string;
    balance: number;
  };
  onUpdate: (bankId: string, newBalance: number) => Promise<void>;
};

export function EditBankBalanceDialog({ bank, onUpdate }: EditBankBalanceDialogProps) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ balance: number }>({
    resolver: zodResolver(schema),
    defaultValues: { balance: bank.balance }
  });

  const onSubmit = async (data: { balance: number }) => {
    try {
      await onUpdate(bank.id, data.balance);
      toast.success('Saldo atualizado!');
      setOpen(false);
      reset({ balance: data.balance });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar saldo');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Editar Saldo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Saldo de {bank.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Novo Saldo</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              {...register('balance', { valueAsNumber: true })}
              placeholder="0,00"
            />
            {errors.balance && (
              <p className="text-xs text-destructive">{errors.balance.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
