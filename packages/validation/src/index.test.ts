import {describe,expect,it} from 'vitest';import {createHandoverSchema,receiverSignatureSchema,signatureSchema} from './index';
describe('createHandoverSchema',()=>{it('rejects empty data',()=>expect(createHandoverSchema.safeParse({}).success).toBe(false));});
describe('four-signature workflow validation',()=>{
  it('requires the receiver to confirm joint inventory',()=>expect(receiverSignatureSchema.safeParse({username:'nv02',password:'A25@123456',signatureText:'Trần Văn Nam',inventoryConfirmed:false}).success).toBe(false));
  it('accepts a complete receiver signature request',()=>expect(receiverSignatureSchema.safeParse({username:'nv02',password:'A25@123456',signatureText:'Trần Văn Nam',inventoryConfirmed:true}).success).toBe(true));
  it('rejects an empty signature',()=>expect(signatureSchema.safeParse({signatureText:' '}).success).toBe(false));
});
