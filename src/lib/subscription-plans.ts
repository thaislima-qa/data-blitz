import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionPlan {
  tipo_plano: 'trimestral' | 'semestral';
  data_vencimento: Date;
  data_inicio: string; // formato mm/aaaa
  data_fim: string; // formato mm/aaaa
  valor?: number;
  nome_cliente?: string;
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
            nome_cliente: nomeCliente
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
    
    const stringValue = String(value).trim().replace(/[R$\s]/g, '');
    
    // Tenta converter para número
    const numericValue = parseFloat(stringValue.replace(',', '.'));
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
 * Salva os planos identificados no Supabase
 */
export const saveSubscriptionPlans = async (plans: SubscriptionPlan[]): Promise<boolean> => {
  if (plans.length === 0) return true;

  try {
    // Converte Date para string no formato ISO para o Supabase
    const plansForDB = plans.map(plan => ({
      ...plan,
      data_vencimento: plan.data_vencimento.toISOString().split('T')[0] // formato YYYY-MM-DD
    }));

    const { error } = await supabase
      .from('subscription_plans')
      .insert(plansForDB);

    if (error) {
      console.error('Erro ao salvar planos:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao salvar planos:', error);
    return false;
  }
};

/**
 * Busca planos ativos no período especificado
 */
export const getActivePlansInPeriod = async (startDate: Date, endDate: Date): Promise<SubscriptionPlan[]> => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .gte('data_vencimento', startDate.toISOString().split('T')[0])
      .lte('data_vencimento', endDate.toISOString().split('T')[0]);

    if (error) {
      console.error('Erro ao buscar planos ativos:', error);
      return [];
    }

    // Converte os dados do Supabase para o tipo correto
    return (data || []).map(item => ({
      tipo_plano: item.tipo_plano as 'trimestral' | 'semestral',
      data_vencimento: new Date(item.data_vencimento),
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
      valor: item.valor || undefined,
      nome_cliente: item.nome_cliente || undefined
    }));
  } catch (error) {
    console.error('Erro ao buscar planos ativos:', error);
    return [];
  }
};