export type FinanceEntry={
  id:string;
  type:'INCOME'|'EXPENSE';
  content:string;
  amount:string;
  paymentMethod:'CASH'|'TRANSFER';
  reason:string;
};
export type FinanceData={version:2;fixedFund:number;entries:Array<Omit<FinanceEntry,'id'|'amount'>&{amount:number}>};
export const emptyFinanceEntry=():FinanceEntry=>({id:crypto.randomUUID(),type:'INCOME',content:'',amount:'',paymentMethod:'CASH',reason:''});
export function moneyValue(value:string){const parsed=Number(value.replace(/[^0-9]/g,''));return Number.isFinite(parsed)?parsed:0}
export function formatMoney(value:number){return new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value)}
export function formatMoneyInput(value:string){const digits=value.replace(/[^0-9]/g,'');return digits?formatMoney(Number(digits)):''}
export function financeTotals(fixedFund:string,entries:FinanceEntry[]){
  const totalIncome=entries.filter(item=>item.type==='INCOME').reduce((sum,item)=>sum+moneyValue(item.amount),0);
  const totalExpense=entries.filter(item=>item.type==='EXPENSE').reduce((sum,item)=>sum+moneyValue(item.amount),0);
  const cashTotal=entries.filter(item=>item.paymentMethod==='CASH').reduce((sum,item)=>sum+moneyValue(item.amount),0);
  const transferTotal=entries.filter(item=>item.paymentMethod==='TRANSFER').reduce((sum,item)=>sum+moneyValue(item.amount),0);
  return{totalIncome,totalExpense,cashTotal,transferTotal,endingBalance:moneyValue(fixedFund)+totalIncome-totalExpense};
}
export function serializeFinance(fixedFund:string,entries:FinanceEntry[]){
  const data:FinanceData={version:2,fixedFund:moneyValue(fixedFund),entries:entries.filter(item=>item.content.trim()||moneyValue(item.amount)>0).map(item=>({type:item.type,content:item.content.trim(),amount:moneyValue(item.amount),paymentMethod:item.paymentMethod,reason:item.reason.trim()}))};
  return JSON.stringify(data);
}
export function parseFinance(details:string):FinanceData|null{try{const value=JSON.parse(details) as Partial<FinanceData>;if(value.version!==2||!Array.isArray(value.entries)||typeof value.fixedFund!=='number')return null;return value as FinanceData}catch{return null}}
