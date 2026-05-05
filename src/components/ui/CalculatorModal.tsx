import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Delete, X } from 'lucide-react';

interface CalculatorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  initialValue?: number;
}

export function CalculatorModal({ open, onClose, onConfirm, initialValue }: CalculatorModalProps) {
  const [display, setDisplay] = useState(
    initialValue && initialValue > 0 ? String(initialValue) : '0'
  );
  const [expression, setExpression] = useState('');
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const handleDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(prev => prev === '0' ? digit : prev + digit);
    }
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0,');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(',')) {
      setDisplay(prev => prev + ',');
    }
  };

  const parseDisplay = (val: string) => parseFloat(val.replace(',', '.'));

  const handleOperator = (op: string) => {
    const current = parseDisplay(display);
    setExpression(`${display} ${op}`);
    setWaitingForOperand(true);
    setDisplay(String(current).replace('.', ','));
  };

  const handleEquals = () => {
    if (!expression) return;
    const parts = expression.trim().split(' ');
    const left = parseFloat(parts[0].replace(',', '.'));
    const op = parts[1];
    const right = parseDisplay(display);
    let result = 0;
    switch (op) {
      case '+': result = left + right; break;
      case '-': result = left - right; break;
      case '×': result = left * right; break;
      case '÷': result = right !== 0 ? left / right : 0; break;
    }
    const formatted = parseFloat(result.toFixed(2));
    setDisplay(String(formatted).replace('.', ','));
    setExpression('');
    setWaitingForOperand(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    if (waitingForOperand) return;
    setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const handleConfirm = () => {
    const value = parseDisplay(display);
    if (!isNaN(value) && value > 0) {
      onConfirm(value);
      onClose();
    }
  };

  const btnBase = 'h-12 text-base font-medium rounded-xl';
  const btnBase2 = 'h-12 w-full text-base font-semibold rounded-2xl border-0 cursor-pointer transition-all duration-150 active:scale-95 select-none';
  const btnNum = `${btnBase2} bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm`;
  const btnOp  = `${btnBase2} bg-blue-400/40 hover:bg-blue-400/60 text-blue-100`;
  const btnClr = `${btnBase2} bg-white/10 hover:bg-white/20 text-white/80`;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-xs p-0 border-0 shadow-none bg-transparent overflow-hidden [&>button]:hidden"
        style={{ background: 'transparent', boxShadow: 'none' }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Calculadora</DialogTitle>
          <DialogDescription>Use a calculadora para definir o valor e confirmar em Usar valor.</DialogDescription>
        </DialogHeader>

        {/* Glass card */}
        <div
          className="rounded-3xl p-5 flex flex-col gap-4"
          style={{
            background: 'rgba(30, 40, 80, 0.55)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar calculadora"
            className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center"
          >
            <X size={15} />
          </button>

          {/* Title */}
          <p className="text-white/60 text-xs font-semibold tracking-widest uppercase px-1">Calculadora</p>

          {/* Display */}
          <div
            className="rounded-2xl px-4 py-3 text-right"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-xs text-white/40 min-h-[16px] tracking-wide">{expression}&nbsp;</p>
            <p className="text-3xl font-bold tracking-tight text-white truncate">
              {display.length > 0
                ? parseFloat(display.replace(',', '.')).toLocaleString('pt-BR', {
                    minimumFractionDigits: display.includes(',') ? (display.split(',')[1]?.length ?? 0) : 0,
                    maximumFractionDigits: 2,
                  })
                : '0'}
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button type="button" className={btnClr} onClick={handleClear}>C</button>
            <button type="button" className={btnClr} onClick={handleBackspace}><Delete size={15} className="mx-auto" /></button>
            <button type="button" className={btnOp} onClick={() => handleOperator('÷')}>÷</button>
            <button type="button" className={btnOp} onClick={() => handleOperator('×')}>×</button>

            {['7','8','9'].map(d => (
              <button type="button" key={d} className={btnNum} onClick={() => handleDigit(d)}>{d}</button>
            ))}
            <button type="button" className={btnOp} onClick={() => handleOperator('-')}>−</button>

            {['4','5','6'].map(d => (
              <button type="button" key={d} className={btnNum} onClick={() => handleDigit(d)}>{d}</button>
            ))}
            <button type="button" className={btnOp} onClick={() => handleOperator('+')}>+</button>

            {['1','2','3'].map(d => (
              <button type="button" key={d} className={btnNum} onClick={() => handleDigit(d)}>{d}</button>
            ))}
            <button
              type="button"
              className={`${btnOp} row-span-2`}
              style={{ gridRow: 'span 2 / span 2' }}
              onClick={handleEquals}
            >=</button>

            <button type="button" className={`${btnNum} col-span-2`} onClick={() => handleDigit('0')}>0</button>
            <button type="button" className={btnNum} onClick={handleDecimal}>,</button>
          </div>

          {/* Confirm */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full h-12 rounded-2xl text-white font-semibold text-base cursor-pointer transition-all duration-150 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
          >
            Usar valor
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
