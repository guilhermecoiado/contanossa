import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { testSupabaseConnection } from '@/lib/supabaseConnection';
import { Member } from '@/types/finance';
import { SubscriptionPlan, normalizePlan } from '@/lib/plans';

interface AuthContextType {
  currentMember: Member | null;
  user: SupabaseUser | null;
  currentPlan: SubscriptionPlan;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: { email: string; password: string; name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refetchMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getMemberByAuthUserId(authUserId: string, retryCount = 0): Promise<Member | null> {
  try {
    const startTime = performance.now();
    
    // Timeout progressivo: 3s, 5s, 8s
    const timeoutMs = retryCount === 0 ? 3000 : retryCount === 1 ? 5000 : 8000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('QUERY_TIMEOUT')), timeoutMs);
    });

    const queryPromise = supabase
      .from('members')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
    
    void startTime;
    
    if (error) {
      // 401 = unauthorized, sessão expirou
      if (error.code === 'PGRST301' || error.status === 401) {
        throw new Error('SESSION_EXPIRED');
      }
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    return data as Member;
  } catch (err: any) {
    if (err.message === 'QUERY_TIMEOUT') {
      // Tentar até 3 vezes com delays progressivos
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 1000; // 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
        return getMemberByAuthUserId(authUserId, retryCount + 1);
      }
      
      throw new Error('SESSION_EXPIRED');
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentPlan = normalizePlan(user?.user_metadata?.plan);
  const fetchStateRef = useRef({
    isFetching: false,
    lastUserId: null as string | null,
    lastFetchedAt: 0,
  });

  const refetchMember = useCallback(async () => {
    if (!user?.id) {
      setCurrentMember(null);
      return;
    }
    try {
      const member = await getMemberByAuthUserId(user.id);
      setCurrentMember(member);
    } catch {
      setCurrentMember(null);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    let lockTimeout: NodeJS.Timeout | null = null;
    let initialLoadHandled = false;

    // O onAuthStateChange dispara automaticamente com a sessão atual ao se inscrever
    // quando persistSession está ativo
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // Primeira vez que dispara é o estado inicial
      const isInitialEvent = !initialLoadHandled;
      if (!initialLoadHandled) {
        initialLoadHandled = true;
      }
      
      setUser(session?.user ?? null);
      
      if (session?.user?.id) {
        const userId = session.user.id;
        const now = Date.now();
        const sameUser = fetchStateRef.current.lastUserId === userId;
        if (fetchStateRef.current.isFetching && sameUser) {
          return;
        }
        if (sameUser && now - fetchStateRef.current.lastFetchedAt < 2000) {
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }
        // Nao aguardar aqui para evitar deadlock do auth lock.
        void (async () => {
          if (!mounted) return;
          fetchStateRef.current.isFetching = true;
          if (isInitialEvent && event === 'SIGNED_IN') {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          try {
            const member = await getMemberByAuthUserId(userId);
            if (mounted) setCurrentMember(member);
            fetchStateRef.current.lastUserId = userId;
            fetchStateRef.current.lastFetchedAt = Date.now();
          } catch (err: any) {
            // Se receber SESSION_EXPIRED ou 401, fazer logout
            if (err.message === 'SESSION_EXPIRED' || err.status === 401) {
              if (mounted) {
                await supabase.auth.signOut();
                setUser(null);
                setCurrentMember(null);
              }
              fetchStateRef.current.lastUserId = null;
              fetchStateRef.current.lastFetchedAt = 0;
            } else {
              if (mounted) setCurrentMember(null);
            }
          } finally {
            fetchStateRef.current.isFetching = false;
            if (mounted) {
              setIsLoading(false);
            }
          }
        })();
      } else {
        setCurrentMember(null);
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    // Timeout de segurança adicional
    const safetyTimeout = setTimeout(() => {
      if (mounted && !initialLoadHandled) {
        setIsLoading(false);
      }
    }, 3000);

    if (import.meta.env.DEV) {
      lockTimeout = setTimeout(async () => {
        const result = await testSupabaseConnection();
        if (!result.ok) {
          console.error('[Supabase] Falha na conexão:', result.error, result.details ?? '');
        }
      }, 1000);
    }

    return () => {
      mounted = false;
      if (lockTimeout) clearTimeout(lockTimeout);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error('[Supabase Auth] Erro no login:', {
          code: error.code,
          message: error.message,
          status: (error as { status?: number }).status,
        });
      }
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('invalid login credentials') || error.code === 'invalid_credentials') {
        throw new Error(
          'Credenciais inválidas. Confira se o email e a senha estão corretos.'
        );
      }
      throw error;
    }
    if (!data.user?.id) throw new Error('Falha ao obter usuário');
    try {
      const member = await getMemberByAuthUserId(data.user.id);
      setCurrentMember(member ?? null);
    } catch (err: any) {
      // Se receber SESSION_EXPIRED ou 401, fazer logout
      if (err.message === 'SESSION_EXPIRED' || err.status === 401) {
        await supabase.auth.signOut();
        throw new Error('Sua sessão expirou durante o login. Por favor, tente novamente.');
      }
      const detail = err instanceof Error ? err.message : String(err);
      if (import.meta.env.DEV) console.error('[Supabase] Erro ao buscar member após login:', err);
      throw new Error(
        'Login OK, mas não foi possível carregar seu perfil. Detalhe: ' +
          detail
      );
    }
    // Se não houver member (ex.: usuário criado só no Auth), o app redireciona para /complete-registration
  }, []);

  const signUp = useCallback(async (params: {
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) => {
    try {
      // Criar usuário no Auth
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: { 
            name: params.name, 
            phone: params.phone ?? null 
          },
        },
      });
      
      if (error) {
        console.error('[signUp] Erro ao criar usuário no Auth:', error);
        throw error;
      }
      
      if (!data.user?.id) throw new Error('Falha ao criar conta');

      // Aguardar um pouco para o trigger criar o membro
      await new Promise(resolve => setTimeout(resolve, 500));

      // Buscar o membro criado pelo trigger
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (memberError) {
        console.error('[signUp] Erro ao buscar membro:', memberError);
        throw memberError;
      }

      if (!member) {
        // Fallback: criar manualmente se o trigger não funcionou
        const baseUsername = params.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const familyId = crypto.randomUUID();
        const familyPublicId = `FAM-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
        
        try {
          // Tentar com username
          const { data: manualMember, error: manualError } = await supabase
            .from('members')
            .insert({
              auth_user_id: data.user.id,
              family_id: familyId,
              family_public_id: familyPublicId,
              name: params.name,
              email: params.email,
              username: baseUsername,
              phone: params.phone || null,
              password_hash: null,
            })
            .select()
            .single();

          if (manualError) {
            // Se falhar pela coluna username, tentar sem ela
            if (manualError.message.includes('username')) {
              const { data: memberNoUsername, error: errorNoUsername } = await supabase
                .from('members')
                .insert({
                  auth_user_id: data.user.id,
                  family_id: familyId,
                  family_public_id: familyPublicId,
                  name: params.name,
                  email: params.email,
                  phone: params.phone || null,
                  password_hash: null,
                })
                .select()
                .single();

              if (errorNoUsername) {
                console.error('[signUp] Erro ao criar membro:', errorNoUsername);
                throw errorNoUsername;
              }

              setCurrentMember(memberNoUsername as Member);
            } else {
              throw manualError;
            }
          } else {
            setCurrentMember(manualMember as Member);
          }
        } catch (err) {
          console.error('[signUp] Erro ao criar membro manualmente:', err);
          throw err;
        }
      } else {
        setCurrentMember(member as Member);
      }
    } catch (err) {
      console.error('[signUp] Erro geral:', err);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentMember(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentMember,
        user,
        currentPlan,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        logout,
        refetchMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
