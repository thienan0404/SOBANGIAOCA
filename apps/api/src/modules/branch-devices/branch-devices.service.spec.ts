import {ConflictException,ForbiddenException,UnauthorizedException} from '@nestjs/common';
import {PrismaService} from '../../infrastructure/database/prisma/prisma.service';
import {BranchDevicesService,branchDeviceTokenHash} from './branch-devices.service';

const branch={id:'6f0df350-9662-4c37-9a93-55e4c73f8326',code:'45PCT',name:'45 Phan Chu Trinh',organizationId:'3fbb378a-e6ee-47bb-b3c5-c33210df4421'};
const input={branchId:branch.id,deviceCode:'45PCT-FRONTDESK-01',deviceName:'Qu?y l? t?n ch?nh'};

function createFixture(){
  const prisma={
    branch:{findUnique:jest.fn().mockResolvedValue(branch)},
    branchMembership:{findFirst:jest.fn().mockResolvedValue({id:'membership-id'})},
    branchDevice:{
      findUnique:jest.fn().mockResolvedValue(null),
      create:jest.fn().mockResolvedValue({id:'device-id',deviceCode:input.deviceCode,deviceName:input.deviceName}),
      updateMany:jest.fn().mockResolvedValue({count:1})
    }
  };
  return{prisma,service:new BranchDevicesService(prisma as unknown as PrismaService)};
}

describe('BranchDevicesService',()=>{
  it('allows a branch manager to register a device',async()=>{
    const{service}=createFixture();
    const result=await service.register('manager-id',input);
    expect(result).toMatchObject({deviceId:'device-id',deviceCode:input.deviceCode,branch:{id:branch.id,code:branch.code,name:branch.name}});
    expect(result.deviceToken).toMatch(/^a25dv_[A-Za-z0-9_-]{43}$/);
  });

  it('rejects a normal employee registration',async()=>{
    const{service,prisma}=createFixture();
    prisma.branchMembership.findFirst.mockResolvedValue(null);
    await expect(service.register('employee-id',input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.branchDevice.create).not.toHaveBeenCalled();
  });

  it('requires a unique device code',async()=>{
    const{service,prisma}=createFixture();
    prisma.branchDevice.findUnique.mockResolvedValue({id:'existing-device'});
    await expect(service.register('manager-id',input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('never stores the raw device token',async()=>{
    const{service,prisma}=createFixture();
    const result=await service.register('manager-id',input);
    const stored=prisma.branchDevice.create.mock.calls[0][0].data;
    expect(stored.deviceTokenHash).toBe(branchDeviceTokenHash(result.deviceToken));
    expect(stored.deviceTokenHash).not.toBe(result.deviceToken);
    expect(JSON.stringify(stored)).not.toContain(result.deviceToken);
  });

  it('returns the assigned branch for a valid device token',async()=>{
    const{service,prisma}=createFixture();
    prisma.branchDevice.findUnique.mockResolvedValue({
      id:'device-id',deviceCode:input.deviceCode,deviceName:input.deviceName,isActive:true,revokedAt:null,branch
    });
    const result=await service.current('valid-device-token');
    expect(result.branch).toMatchObject({id:branch.id,code:branch.code,name:branch.name});
  });

  it('rejects a revoked device',async()=>{
    const{service,prisma}=createFixture();
    prisma.branchDevice.findUnique.mockResolvedValue({
      id:'device-id',deviceCode:input.deviceCode,deviceName:input.deviceName,isActive:false,revokedAt:new Date(),branch
    });
    await expect(service.current('revoked-device-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.branchDevice.updateMany).not.toHaveBeenCalled();
  });

  it('updates last_seen_at when validating a device',async()=>{
    const{service,prisma}=createFixture();
    prisma.branchDevice.findUnique.mockResolvedValue({
      id:'device-id',deviceCode:input.deviceCode,deviceName:input.deviceName,isActive:true,revokedAt:null,branch
    });
    const before=Date.now();
    await service.current('valid-device-token');
    expect(prisma.branchDevice.updateMany).toHaveBeenCalledWith({
      where:{id:'device-id',isActive:true,revokedAt:null},data:{lastSeenAt:expect.any(Date)}
    });
    const updatedAt=prisma.branchDevice.updateMany.mock.calls[0][0].data.lastSeenAt as Date;
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
