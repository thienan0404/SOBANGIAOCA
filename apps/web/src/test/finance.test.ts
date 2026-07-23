import {describe,expect,it} from 'vitest';
import {financeTotals,formatMoney,formatMoneyInput,parseFinance,serializeFinance,type FinanceEntry} from '../features/handovers/lib/finance';

const entries:FinanceEntry[]=[
  {id:'income',type:'INCOME',content:'Thu tiền phòng',amount:'2.000.000',paymentMethod:'TRANSFER',reason:'Khách thanh toán tiền phòng'},
  {id:'expense',type:'EXPENSE',content:'Mua văn phòng phẩm',amount:'280.000',paymentMethod:'CASH',reason:'Bổ sung giấy in'}
];

describe('finance ledger',()=>{
  it('formats money with comma thousands separators while typing',()=>{
    expect(formatMoneyInput('1000000')).toBe('1,000,000');
    expect(formatMoneyInput('1,000,000')).toBe('1,000,000');
    expect(formatMoneyInput('')).toBe('');
    expect(formatMoney(2500000)).toBe('2,500,000');
  });

  it('calculates income, expense, payment methods and ending balance',()=>{
    expect(financeTotals('5.000.000',entries)).toEqual({totalIncome:2000000,totalExpense:280000,cashTotal:280000,transferTotal:2000000,endingBalance:6720000});
  });

  it('serializes structured finance data without UI-only ids',()=>{
    const serialized=serializeFinance('5.000.000',entries);
    expect(serialized).not.toContain('"id"');
    expect(parseFinance(serialized)).toMatchObject({version:2,fixedFund:5000000,entries:[{content:'Thu tiền phòng',amount:2000000},{content:'Mua văn phòng phẩm',amount:280000}]});
  });

  it('keeps legacy finance text detectable',()=>{
    expect(parseFinance('Quỹ cố định: 5.000.000')).toBeNull();
  });
});
