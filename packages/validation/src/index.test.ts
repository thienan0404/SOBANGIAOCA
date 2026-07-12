import {describe,expect,it} from 'vitest';import {createHandoverSchema} from './index';
describe('createHandoverSchema',()=>{it('rejects empty data',()=>expect(createHandoverSchema.safeParse({}).success).toBe(false));});
