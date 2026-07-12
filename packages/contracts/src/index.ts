export enum HandoverStatus { DRAFT='DRAFT', SUBMITTED='SUBMITTED', PENDING_RECEIVER_CONFIRMATION='PENDING_RECEIVER_CONFIRMATION', SUPPLEMENT_REQUESTED='SUPPLEMENT_REQUESTED', RESUBMITTED='RESUBMITTED', CONFIRMED='CONFIRMED', COMPLETED='COMPLETED', CANCELLED='CANCELLED', OVERDUE='OVERDUE' }
export enum ParticipantType { GIVER='GIVER', RECEIVER='RECEIVER', SUPERVISOR='SUPERVISOR', APPROVER='APPROVER' }
export type ApiSuccess<T>={data:T;meta?:Record<string,unknown>;requestId:string};
export type ApiFailure={error:{code:string;message:string;details?:Record<string,unknown>};requestId:string};
export type PaginationQuery={page?:number;pageSize?:number;sort?:string;direction?:'asc'|'desc';branchId?:string;status?:string;from?:string;to?:string};
export type HandoverItemInput={title:string;details:string;category:string;priority:'LOW'|'NORMAL'|'HIGH'|'URGENT';roomNumber?:string|undefined};
export type CreateHandoverRequest={branchId:string;shiftInstanceId:string;receiverId:string;notes?:string|undefined;items:HandoverItemInput[]};
export type HandoverSummary={id:string;code:string;status:HandoverStatus;branchId:string;giver:{id:string;name:string};receiver:{id:string;name:string};createdAt:string;submittedAt?:string};
