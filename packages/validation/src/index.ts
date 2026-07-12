import {z} from 'zod';
export const uuidSchema=z.string().uuid('ID không hợp lệ');
export const handoverItemSchema=z.object({title:z.string().trim().min(3).max(180),details:z.string().trim().min(1).max(5000),category:z.string().min(1).max(50),priority:z.enum(['LOW','NORMAL','HIGH','URGENT']),roomNumber:z.string().max(20).optional()});
export const createHandoverSchema=z.object({branchId:uuidSchema,shiftInstanceId:uuidSchema,receiverId:uuidSchema,notes:z.string().max(5000).optional(),items:z.array(handoverItemSchema).min(1)});
export const transitionReasonSchema=z.object({reason:z.string().trim().min(3).max(2000)});
export const paginationSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),branchId:uuidSchema.optional(),status:z.string().optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional()});
