import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMembers } from '@/hooks/useMembers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  account_type: z.string().optional(),
  balance: z.number().optional(),
});

type EditBankDialogProps = {
  bank: {
    id: string;
    name: string;
    account_type?: string;
    balance: number;
  };
  onUpdate: (bankId: string, data: { name: string; account_type?: string; balance?: number }) => Promise<void>;
  onDelete: (bankId: string) => Promise<void>;
};

export function EditBankDialog({ bank, onUpdate, onDelete, trigger }: EditBankDialogProps & { trigger?: React.ReactNode }) {
  const { data: members = [] } = useMembers();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<{ name: string; account_type?: string; balance?: number; member_id?: string }>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: bank.name,
      account_type: bank.account_type,
      balance: bank.balance,
      member_id: bank.member_id,
    },
  });

  const onSubmit = async (data: { name: string; account_type?: string; balance?: number; member_id?: string }) => {
    try {
      await onUpdate(bank.id, data);
      toast.success('Banco atualizado!');
      setOpen(false);
      reset(data);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar banco');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir este banco?')) {
      try {
        await onDelete(bank.id);
        toast.success('Banco excluído!');
        setOpen(false);
      } catch (e: any) {
        toast.error(e.message || 'Erro ao excluir banco');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Editar</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Banco</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Membro da Família</Label>
            <Select
              onValueChange={value => setValue('member_id', value)}
              defaultValue={bank.member_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Banco</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tipo de Conta</Label>
            <Select onValueChange={value => setValue('account_type', value)} defaultValue={bank.account_type || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Conta Corrente</SelectItem>
                <SelectItem value="savings">Poupança</SelectItem>
                <SelectItem value="digital">Conta Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance">Saldo</Label>
            <Input
              id="balance"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={formatCurrency(watch('balance') || 0)}
              onChange={e => {
                const value = e.target.value;
                const isNegative = value.includes('-');
                let digits = value.replace(/\D/g, '');
                let number = digits ? parseFloat(digits) / 100 : 0;
                if (isNegative) number = -number;
                setValue('balance', number);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="w-full">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
