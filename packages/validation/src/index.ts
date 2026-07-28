import {z} from 'zod';
export const uuidSchema=z.string().uuid('ID không hợp lệ');
export const handoverItemSchema=z.object({title:z.string().trim().min(3).max(180),details:z.string().trim().min(1).max(5000),category:z.string().min(1).max(50),priority:z.enum(['LOW','NORMAL','HIGH','URGENT']),roomNumber:z.string().max(20).optional()});
export const createHandoverSchema=z.object({branchId:uuidSchema,shiftInstanceId:uuidSchema,receiverId:uuidSchema,notes:z.string().max(5000).optional(),items:z.array(handoverItemSchema).min(1)});
export const transitionReasonSchema=z.object({reason:z.string().trim().min(3).max(2000)});
export const signatureSchema=z.object({signatureText:z.string().trim().min(2).max(120)});
export const receiverSignatureSchema=signatureSchema.extend({
  username:z.string().trim().min(3).max(80),
  password:z.string().min(6).max(200),
  inventoryConfirmed:z.literal(true)
});
export const receiverSupplementSchema=z.object({
  username:z.string().trim().min(3).max(80),
  password:z.string().min(6).max(200),
  reason:z.string().trim().min(3).max(2000)
});
export const receiverAmendmentSchema=signatureSchema.extend({
  username:z.string().trim().min(3).max(80),
  password:z.string().min(6).max(200),
  reason:z.string().trim().min(3).max(2000),
  correction:z.string().trim().min(3).max(5000),
  scope:z.enum(['OPERATIONS','FINANCE','BOTH'])
});
export const paginationSchema=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),branchId:uuidSchema.optional(),status:z.string().optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional()});
export const roomAttentionTagTypeSchema=z.enum(['SPECIAL_REQUEST','EXTRA_CARE','ROOM_ISSUE','GUEST_DEBT','WAKE_UP','TRANSPORT','GUEST_ASSET','OTHER']);
export const roomAttentionPrioritySchema=z.enum(['NORMAL','IMPORTANT','URGENT']);
export const roomAttentionStatusSchema=z.enum(['OPEN','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED']);
const factualRoomAttentionText=z.string().trim().min(3).max(5000).refine(value=>!/(khách khó|khach kho)/i.test(value),'Hãy mô tả tình huống thực tế, không dùng nhãn cảm tính');
export const createRoomAttentionTagSchema=z.object({
  branchId:z.string().uuid(),stayReference:z.string().trim().min(2).max(100),roomNumber:z.string().trim().min(1).max(20),guestName:z.string().trim().min(2).max(160),checkInDate:z.iso.date(),expectedCheckOutDate:z.iso.date(),tagType:roomAttentionTagTypeSchema,priority:roomAttentionPrioritySchema.default('NORMAL'),title:factualRoomAttentionText.pipe(z.string().max(180)),details:factualRoomAttentionText
}).refine(data=>data.expectedCheckOutDate>=data.checkInDate,{message:'Ngày check-out dự kiến không được trước ngày check-in',path:['expectedCheckOutDate']});
export const updateRoomAttentionTagSchema=z.object({content:factualRoomAttentionText,priority:roomAttentionPrioritySchema.optional(),status:z.enum(['OPEN','IN_PROGRESS','RESOLVED']).optional()});
export const closeRoomAttentionTagSchema=z.object({closeReason:z.string().trim().min(3).max(500),finalResult:z.string().trim().min(3).max(5000)});
export const cancelRoomAttentionTagSchema=closeRoomAttentionTagSchema;
