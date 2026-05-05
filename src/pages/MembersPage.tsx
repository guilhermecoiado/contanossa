import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MemberForm } from '@/components/forms/MemberForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useMembers, useIncomeSources, useDeleteMember } from '@/hooks/useMembers';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import { Plus, User, DollarSign, Edit, Trash2, Banknote, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Member } from '@/types/finance';
import { toast } from 'sonner';
import { isEssentialPlan } from '@/lib/plans';

export default function MembersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [expandedSourcesByMember, setExpandedSourcesByMember] = useState<Record<string, boolean>>({});

  const { data: members = [], isLoading } = useMembers();
  const { data: incomeSources = [] } = useIncomeSources();
  const { currentMember, currentPlan } = useAuth();
  const deleteMember = useDeleteMember();
  const isEssential = isEssentialPlan(currentPlan);
  const memberLimit = isEssential ? 3 : Infinity;
  const canAddMember = members.length < memberLimit;

  const getMemberIncomeSources = (memberId: string) => {
    return incomeSources.filter(s => s.member_id === memberId);
  };

  const getTotalFixedIncome = (memberId: string) => {
    return getMemberIncomeSources(memberId)
      .filter(s => s.is_fixed && s.amount)
      .reduce((sum, s) => sum + Number(s.amount), 0);
  };

  // Soma total de rendas fixas de todos os membros
  const totalFamilyIncome = members.reduce((total, member) => {
    return total + getTotalFixedIncome(member.id);
  }, 0);

  const handleDeleteMember = async (member: Member) => {
    if (currentMember?.id === member.id) {
      toast.error('Você não pode deletar sua própria conta');
      return;
    }

    setMemberToDelete(member);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;

    try {
      await deleteMember.mutateAsync(memberToDelete.id);
      toast.success(`${memberToDelete.name} foi removido da família`);
      setDeleteConfirmOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar membro';
      toast.error(message);
    }
  };

  return (
    <MainLayout>

      <div className="space-y-6">

        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Desktop Header */}
            <div className="hidden sm:flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl gradient-family flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  Membros da Família
                </h1>
                <p className="text-muted-foreground">
                  Gerencie os membros e suas fontes de renda
                </p>
              </div>
            </div>
            {/* Mobile Header Box */}
            <div className="sm:hidden flex flex-col items-center gap-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl p-4 border border-green-200 dark:border-green-800 shadow-sm w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-family flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-foreground">
                  Membros da Família
                </h1>
              </div>
              <p className="text-muted-foreground text-center text-sm">
                Gerencie os membros e suas fontes de renda
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="mt-4 sm:mt-0" 
                  disabled={!canAddMember}
                  onClick={() => {
                    if (!canAddMember) {
                      toast.error(`O plano ContaNossa Essencial permite no máximo ${memberLimit} membros`);
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Membro
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pt-1 pb-2">
                  <DialogTitle>Adicionar membro da família</DialogTitle>
                  <p className="sr-only">Formulário para adicionar um novo membro à família</p>
                </DialogHeader>
                <MemberForm onSuccess={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
          {/* Box de total de rendas dos membros */}
          <div className="w-full flex">
            <div className="flex w-full flex-col sm:flex-row items-center sm:items-center gap-4 glass-card rounded-2xl px-4 py-4 sm:px-6 sm:py-4 text-center sm:text-left">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-green-500/90 dark:bg-green-600/80">
                <Banknote className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Total Rendas Fixas</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-300">
                  {formatCurrency(totalFamilyIncome)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pt-1 pb-3 sm:pb-2">
                <DialogTitle>Editar membro</DialogTitle>
                <p className="sr-only">Formulário para editar as informações do membro</p>
              </DialogHeader>
              {editingMember && (
                <MemberForm 
                  member={{
                    ...editingMember,
                    incomeSources: incomeSources.filter(s => s.member_id === editingMember.id)
                  }}
                  onSuccess={() => setEditingMember(null)} 
                />
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-secondary" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-secondary rounded" />
                    <div className="h-3 w-24 bg-secondary rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum outro membro ainda
            </h3>
            <p className="text-muted-foreground mb-6">
              Adicione membros da família para organizar as finanças de todos
              {isEssential && ` (máximo ${memberLimit} membros no plano ContaNossa Essencial)`}
            </p>
            <Button 
              onClick={() => {
                if (canAddMember) {
                  setIsAddDialogOpen(true);
                } else {
                  toast.error(`O plano Essencial permite no máximo ${memberLimit} membros`);
                }
              }}
              disabled={!canAddMember}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Membro
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member, index) => {
              const memberSources = [...getMemberIncomeSources(member.id)].sort((a, b) => {
                const aIsVariable = !a.is_fixed;
                const bIsVariable = !b.is_fixed;

                if (aIsVariable !== bIsVariable) return aIsVariable ? 1 : -1;

                const aAmount = Number(a.amount || 0);
                const bAmount = Number(b.amount || 0);
                if (aAmount !== bAmount) return bAmount - aAmount;

                return a.name.localeCompare(b.name, 'pt-BR');
              });
              const isExpanded = Boolean(expandedSourcesByMember[member.id]);
              const visibleSources = isExpanded ? memberSources : memberSources.slice(0, 3);
              const totalFixed = getTotalFixedIncome(member.id);
              const isCurrentMember = currentMember?.id === member.id;

              return (
                <div
                  key={member.id}
                  className="glass-card rounded-2xl p-6 animate-fade-in hover:shadow-xl transition-all"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex gap-2 items-center mb-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMember(member)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {currentMember?.id !== member.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMember(member)}
                              disabled={deleteMember.isPending}
                              className="h-8 w-8 text-destructive hover:bg-red-500 group"
                            >
                              <Trash2 className="w-4 h-4 group-hover:text-white" />
                            </Button>
                          )}
                          {isCurrentMember && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                              Você
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-foreground whitespace-nowrap">
                          {member.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>📧</span>
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>📱</span>
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-income" />
                      <span className="text-sm font-medium">Fontes de Renda</span>
                    </div>
                    {memberSources.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma fonte cadastrada</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleSources.map(source => (
                          <div
                            key={source.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{source.name}</span>
                            {source.is_fixed && source.amount ? (
                              <span className="text-income font-medium">
                                {formatCurrency(Number(source.amount))}
                              </span>
                            ) : (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                Variável
                              </span>
                            )}
                          </div>
                        ))}
                        {memberSources.length > 3 && (
                          <button
                            type="button"
                            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                            onClick={() => setExpandedSourcesByMember((prev) => ({
                              ...prev,
                              [member.id]: !prev[member.id],
                            }))}
                          >
                            <span>
                              {isExpanded ? 'Ocultar demais fontes' : `Ver demais fontes (+${memberSources.length - 3})`}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    )}
                    {totalFixed > 0 && (
                      <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Fixo:</span>
                        <span className="font-bold text-income">{formatCurrency(totalFixed)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Deletar ${memberToDelete?.name}?`}
        description="Esta ação não pode ser desfeita. O membro será permanentemente removido da família."
        actionLabel="Deletar"
        cancelLabel="Cancelar"
        isDangerous
        isLoading={deleteMember.isPending}
        onConfirm={confirmDelete}
      />
    </MainLayout>
  );
}
