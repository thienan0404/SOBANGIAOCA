export const formatVnd=(amount:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(amount);
export const formatVietnamDate=(value:string|Date)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export const safeText=(value:string)=>value.replace(/[<>]/g,'').trim();
