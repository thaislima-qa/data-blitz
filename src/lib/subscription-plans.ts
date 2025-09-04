import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionPlan {
  tipo_plano: 'trimestral' | 'semestral';
  data_vencimento: Date;
  data_inicio: string; // formato mm/aaaa
  data_fim: string; // formato mm/aaaa
  valor?: number;
  nome_cliente?: string;
  sede: string;
}

/**
 * Identifica planos trimestrais e semestrais nos dados CSV
 */
export const identifySubscriptionPlans = (csvData: Record<string, any>[]): SubscriptionPlan[] => {
  const plans: SubscriptionPlan[] = [];
  const planMap = new Map<string, SubscriptionPlan>(); // Para evitar duplicações

  csvData.forEach((row) => {
    // Procura por campos que contenham informações de planos
    const rowText = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ')
      .toLowerCase();

    let tipoPlano: 'trimestral' | 'semestral' | null = null;
    
    if (rowText.includes('trimestral')) {
      tipoPlano = 'trimestral';
    } else if (rowText.includes('semestral')) {
      tipoPlano = 'semestral';
    }

    let sede: 'Maraponga' | 'Fátima' | null = null;
    
    if (rowText.includes('Thais')) {
      sede = 'Maraponga';
    } else if (rowText.includes('Taiana')) {
      sede = 'Fátima';
    }
    

    if (tipoPlano) {
      // Procura por data de vencimento
      const dataVencimento = findDateInRow(row);
      
      if (dataVencimento) {
        const { inicio, fim } = calculatePlanDates(dataVencimento, tipoPlano);
        
        // Procura por valor monetário total
        const valorTotal = findValueInRow(row);
        
        // Calcula o valor mensal baseado no tipo de plano
        const valorMensal = valorTotal ? (tipoPlano === 'trimestral' ? valorTotal / 3 : valorTotal / 6) : undefined;
        
        // Procura por nome do cliente
        const nomeCliente = findClientNameInRow(row);

        // Cria chave única para evitar duplicações
        const chaveUnica = `${nomeCliente || 'sem_nome'}_${tipoPlano}_${dataVencimento.toISOString().split('T')[0]}`;
        
        // Só adiciona se não existe ainda
        if (!planMap.has(chaveUnica)) {
          const plan: SubscriptionPlan = {
            tipo_plano: tipoPlano,
            data_vencimento: dataVencimento,
            data_inicio: inicio,
            data_fim: fim,
            valor: valorMensal,
            nome_cliente: nomeCliente,
            sede: sede
          };
          
          planMap.set(chaveUnica, plan);
          plans.push(plan);
        }
      }
    }
  });

  return plans;
};

/**
 * Procura por datas nos valores da linha do CSV
 */
const findDateInRow = (row: Record<string, any>): Date | null => {
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    
    const stringValue = String(value).trim();
    
    // Tenta diferentes formatos de data
    const dateFormats = [
      // dd/mm/yyyy ou dd/mm/yy
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      // dd/mm
      /(\d{1,2})\/(\d{1,2})/,
      // dd-mm-yyyy
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    ];

    for (const format of dateFormats) {
      const match = stringValue.match(format);
      if (match) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]);
        let year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
        
        // Ajusta ano de 2 dígitos
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        
        // Valida data
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day);
        }
      }
    }
  }
  
  return null;
};

/**
 * Procura por valores monetários na linha
 */
const findValueInRow = (row: Record<string, any>): number | undefined => {
  for (const value of Object.values(row)) {
    if (!value) continue;
    
    const stringValue = String(value).trim();

    // Verifica se a string tem padrão de número/valor monetário (ex: "R$ 123,45")
    if (!/^R\$\s?\d{1,3}(\.\d{3})*(,\d{2})?$/.test(stringValue)) {
      continue; // pula se não parecer valor monetário
    }

    // Remove símbolos e espaços
    const cleanValue = stringValue.replace(/[R$\s]/g, '').replace(',', '.');

    // Tenta converter para número
    const numericValue = parseFloat(cleanValue);
    if (!isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return undefined;
};

/**
 * Procura por nome do cliente na linha
 */
const findClientNameInRow = (row: Record<string, any>): string | undefined => {
  const nameFields = ['nome', 'cliente', 'name', 'client'];
  
  for (const [key, value] of Object.entries(row)) {
    if (nameFields.some(field => key.toLowerCase().includes(field)) && value) {
      return String(value).trim();
    }
  }
  
  return undefined;
};

/**
 * Calcula as datas de início e fim do plano baseado na data de vencimento
 */
const calculatePlanDates = (dataVencimento: Date, tipoPlano: 'trimestral' | 'semestral') => {
  const vencimentoMes = dataVencimento.getMonth(); // 0-based
  const vencimentoAno = dataVencimento.getFullYear();
  
  // A data_inicio é o próprio mês/ano do vencimento
  const inicioMes = vencimentoMes;
  const inicioAno = vencimentoAno;
  
  // A data_fim é calculada baseada no tipo de plano
  let fimMes: number;
  let fimAno: number;

  if (tipoPlano === 'trimestral') {
    // Plano trimestral: 3 meses a partir do vencimento
    fimMes = vencimentoMes + 2;
    fimAno = vencimentoAno;
    
    if (fimMes > 11) {
      fimMes -= 12;
      fimAno += 1;
    }
  } else {
    // Plano semestral: 6 meses a partir do vencimento
    fimMes = vencimentoMes + 5;
    fimAno = vencimentoAno;
    
    if (fimMes > 11) {
      fimMes -= 12;
      fimAno += 1;
    }
  }

  const formatarMesAno = (mes: number, ano: number) => {
    return `${String(mes + 1).padStart(2, '0')}/${ano}`;
  };

  return {
    inicio: formatarMesAno(inicioMes, inicioAno),
    fim: formatarMesAno(fimMes, fimAno)
  };
};

/**
 * Verifica se um plano já existe no Supabase
 */
const planExists = async (plan: SubscriptionPlan): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('nome_cliente', plan.nome_cliente || '')
      .eq('tipo_plano', plan.tipo_plano)
      .eq('data_vencimento', plan.data_vencimento.toISOString().split('T')[0])
      .eq('data_inicio', plan.data_inicio)
      .eq('data_fim', plan.data_fim)
      .limit(1);

    if (error) {
      console.error('Erro ao verificar plano existente:', error);
      return false;
    }

    return (data && data.length > 0);
  } catch (error) {
    console.error('Erro ao verificar plano existente:', error);
    return false;
  }
};

/**
 * Salva os planos identificados no Supabase (apenas os que não existem)
 */
export const saveSubscriptionPlans = async (plans: SubscriptionPlan[]): Promise<{ saved: number; skipped: number }> => {
  if (plans.length === 0) return { saved: 0, skipped: 0 };

  try {
    const newPlans: SubscriptionPlan[] = [];
    let skippedCount = 0;

    // Verifica cada plano individualmente se já existe
    for (const plan of plans) {
      const exists = await planExists(plan);
      if (!exists) {
        newPlans.push(plan);
      } else {
        skippedCount++;
        console.log(`Plano já existe - Cliente: ${plan.nome_cliente}, Tipo: ${plan.tipo_plano}, Vencimento: ${plan.data_vencimento.toLocaleDateString('pt-BR')}`);
      }
    }

    if (newPlans.length === 0) {
      return { saved: 0, skipped: skippedCount };
    }

    // Converte Date para string no formato ISO para o Supabase
    const plansForDB = newPlans.map(plan => ({
      ...plan,
      data_vencimento: plan.data_vencimento.toISOString().split('T')[0] // formato YYYY-MM-DD
    }));

    const { error } = await supabase
      .from('subscription_plans')
      .insert(plansForDB);

    if (error) {
      console.error('Erro ao salvar planos:', error);
      return { saved: 0, skipped: skippedCount };
    }

    return { saved: newPlans.length, skipped: skippedCount };
  } catch (error) {
    console.error('Erro ao salvar planos:', error);
    return { saved: 0, skipped: 0 };
  }
};

/**
 * Busca planos ativos cujo período (data_inicio e data_fim) esteja dentro do período especificado
 */
export const getActivePlansInPeriod = async (startDate: Date, endDate: Date): Promise<SubscriptionPlan[]> => {
  try {
    console.log('🔍 Buscando planos ativos no período:', {
      startDate: startDate.toLocaleDateString('pt-BR'),
      endDate: endDate.toLocaleDateString('pt-BR'),
      startMonth: startDate.getMonth() + 1,
      startYear: startDate.getFullYear(),
      endMonth: endDate.getMonth() + 1,
      endYear: endDate.getFullYear()
    });
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*');

    if (error) {
      console.error('Erro ao buscar planos ativos:', error);
      return [];
    }

    console.log('📊 Planos encontrados no Supabase:', data?.length || 0);

    // Filtra planos cujo período se sobrepõe com o período especificado
    const activePlans = (data || []).filter(item => {
      console.log('🔍 Verificando plano:', {
        nome_cliente: item.nome_cliente,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        data_vencimento: item.data_vencimento
      });

      const planStartParts = item.data_inicio.split('/');
      const planEndParts = item.data_fim.split('/');
      
      if (planStartParts.length !== 2 || planEndParts.length !== 2) {
        console.log('❌ Formato de data inválido para o plano:', item);
        return false;
      }
      
      const planStartYear = parseInt(planStartParts[1]);
      const planStartMonth = parseInt(planStartParts[0]);
      const planEndYear = parseInt(planEndParts[1]);
      const planEndMonth = parseInt(planEndParts[0]);
      
      const filterStartYear = startDate.getFullYear();
      const filterStartMonth = startDate.getMonth() + 1;
      const filterEndYear = endDate.getFullYear();
      const filterEndMonth = endDate.getMonth() + 1;
      
      // Verifica se há sobreposição de períodos (mês/ano)
      // Plano ativo se: período do filtro se sobrepõe com período do plano
      const planStart = planStartYear * 12 + planStartMonth;
      const planEnd = planEndYear * 12 + planEndMonth;
      const filterStart = filterStartYear * 12 + filterStartMonth;
      const filterEnd = filterEndYear * 12 + filterEndMonth;
      
      const isActive = (planStart <= filterEnd && planEnd >= filterStart);
      
      console.log('📅 Verificação de sobreposição:', {
        plano: `${planStartMonth}/${planStartYear} - ${planEndMonth}/${planEndYear}`,
        filtro: `${filterStartMonth}/${filterStartYear} - ${filterEndMonth}/${filterEndYear}`,
        planStart, planEnd, filterStart, filterEnd,
        isActive
      });
      
      return isActive;
    });
    console.log('✅ Planos ativos encontrados:', activePlans.length);

    // Converte os dados do Supabase para o tipo correto
    return activePlans.map(item => ({
      tipo_plano: item.tipo_plano as 'trimestral' | 'semestral',
      data_vencimento: new Date(item.data_vencimento),
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
      valor: item.valor || undefined,
      nome_cliente: item.nome_cliente || undefined,
      sede: item.sede
    }));
  } catch (error) {
    console.error('Erro ao buscar planos ativos:', error);
    return [];
  }
};