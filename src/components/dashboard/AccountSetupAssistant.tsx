import { ReactNode, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, ChevronDown, ChevronUp, FolderKanban, HeartPulse, LayoutDashboard, Sparkles, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AccountSetupAssistantStep {
  id: string;
  title: string;
  description: string;
  section: string;
  completed: boolean;
  icon: ReactNode;
}

interface AccountSetupAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
  onGoToStep: (stepId: string) => void;
  steps: AccountSetupAssistantStep[];
  nextStepId?: string;
  isDismissing?: boolean;
}

export function AccountSetupAssistant({
  open,
  onOpenChange,
  onDismiss,
  onGoToStep,
  steps,
  nextStepId,
  isDismissing = false,
}: AccountSetupAssistantProps) {
  const [showTips, setShowTips] = useState(false);
  const [showCompletedSteps, setShowCompletedSteps] = useState(false);
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextStep = steps.find((step) => step.id === nextStepId) || steps.find((step) => !step.completed);
  const pendingSteps = useMemo(() => steps.filter((step) => !step.completed), [steps]);
  const completedSteps = useMemo(() => steps.filter((step) => step.completed), [steps]);

  const renderStepGrid = (stepList: AccountSetupAssistantStep[]) => {
    let lastSection = '';

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {stepList.map((step) => {
          const sectionChanged = step.section !== lastSection;
          lastSection = step.section;

          return (
            <div key={step.id} className={sectionChanged ? 'sm:col-span-2' : ''}>
              {sectionChanged && (
                <div className="mb-2 mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground first:mt-0">
                  {step.section}
                </div>
              )}

              <button
                type="button"
                onClick={() => onGoToStep(step.id)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all',
                  step.completed
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
                    step.completed
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                      : 'border-primary/15 bg-primary/8 text-primary'
                  )}
                >
                  {step.completed ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-tight">{step.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]',
                        step.completed
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {step.completed ? 'Concluído' : 'Abrir'}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="lg:left-64"
        className="max-w-4xl border-0 bg-transparent p-0 shadow-none lg:left-[calc(50%+8rem)] lg:w-[calc(100%-18rem)]"
      >
        <div className="overflow-hidden rounded-[28px] border border-primary/15 bg-background shadow-2xl">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.86))] px-4 py-5 text-white sm:px-6 sm:py-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-6">
              <DialogHeader className="mb-0 space-y-3 text-left lg:pr-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  ContaNossa
                </div>
                <div className="space-y-2 text-left">
                  <DialogTitle className="text-left text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    Bem-vindo ao ContaNossa
                  </DialogTitle>
                  <DialogDescription className="max-w-[44rem] text-left text-[13px] leading-6 text-white/75 sm:text-sm lg:text-base">
                    Configure os itens essenciais na ordem correta para que o app fique pronto para uso.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm lg:self-start">
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">Próxima ação</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {nextStep?.title || 'Tudo concluído'}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {nextStep?.description || 'Seu ambiente inicial já está configurado.'}
                </p>
                {nextStep && (
                  <Button
                    className="mt-4 w-full bg-white text-slate-950 hover:bg-white/90"
                    onClick={() => onGoToStep(nextStep.id)}
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2 lg:col-span-2">
                <div className="flex items-center justify-between text-sm text-white/75">
                  <span>Progresso inicial</span>
                  <span>{completedCount}/{totalCount} etapas</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-4 rounded-2xl border border-border/70 bg-muted/15 p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setShowTips((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/40"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Dicas importantes
                </span>
                {showTips ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showTips && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      ID da Família
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Use o ID da Família para compartilhar valores com outros usuários: você pode lançar despesas para amigos ou informar seu ID para receber cobranças no painel.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FolderKanban className="h-4 w-4 text-primary" />
                      Categorias e tags personalizadas
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Você pode criar categorias e tags personalizadas para organizar seus lançamentos do seu jeito.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <HeartPulse className="h-4 w-4 text-primary" />
                      Saúde da Família
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Veja valores emprestados, patrimônio, contribuição por membro, gastos por categoria, dicas e percentual de parcelas.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card px-3 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      Dashboard
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      No dashboard você visualiza últimos lançamentos, resumos e suas parcelas e dívidas futuras.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {renderStepGrid(pendingSteps)}

            {completedSteps.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/15 p-2">
                <button
                  type="button"
                  onClick={() => setShowCompletedSteps((current) => !current)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/40"
                >
                  <span>Etapas concluídas ({completedSteps.length})</span>
                  {showCompletedSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showCompletedSteps && (
                  <div className="mt-2">{renderStepGrid(completedSteps)}</div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={onDismiss} disabled={isDismissing}>
                {isDismissing ? 'Salvando...' : 'Não mostrar novamente'}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Continuar depois
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}