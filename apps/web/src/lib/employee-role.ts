export type EmployeeRole={code:string;name:string};
export type RoleGroup='reception'|'management'|'accounting';

const managementRoles=new Set(['BRANCH_DIRECTOR','DEPUTY_BRANCH_DIRECTOR','BRANCH_MANAGER','ADMIN']);
const accountingRoles=new Set(['ACCOUNTANT','CHIEF_ACCOUNTANT']);

export function roleGroup(code?:string|null):RoleGroup{
  if(code&&managementRoles.has(code))return 'management';
  if(code&&accountingRoles.has(code))return 'accounting';
  return 'reception';
}

export function storedEmployeeRole():EmployeeRole|null{
  if(typeof window==='undefined')return null;
  const code=sessionStorage.getItem('a25.employeeRole');
  if(!code)return null;
  return{code,name:sessionStorage.getItem('a25.employeeRoleName')||code};
}