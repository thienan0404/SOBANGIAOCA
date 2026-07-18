import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {createHash,randomBytes} from 'node:crypto';
import {PrismaService} from '../../infrastructure/database/prisma/prisma.service';
import {RegisterBranchDeviceDto} from './dto/register-branch-device.dto';

const REGISTRATION_ROLES=['BRANCH_MANAGER','ADMIN'];

function hashDeviceToken(token:string){
  return createHash('sha256').update(token,'utf8').digest('hex');
}

function isUniqueConstraint(error:unknown){
  return typeof error==='object'&&error!==null&&'code' in error&&(error as {code?:unknown}).code==='P2002';
}

@Injectable()
export class BranchDevicesService {
  constructor(private readonly prisma:PrismaService){}

  async register(userId:string,input:RegisterBranchDeviceDto){
    const branch=await this.prisma.branch.findUnique({
      where:{id:input.branchId},
      select:{id:true,code:true,name:true,organizationId:true}
    });
    if(!branch)throw new NotFoundException('Không tìm thấy chi nhánh');

    const permission=await this.prisma.branchMembership.findFirst({
      where:{
        profileId:userId,
        isActive:true,
        profile:{isActive:true},
        role:{code:{in:REGISTRATION_ROLES}},
        OR:[
          {branchId:branch.id},
          {role:{code:'ADMIN'},branch:{organizationId:branch.organizationId}}
        ]
      },
      select:{id:true}
    });
    if(!permission)throw new ForbiddenException('Chỉ quản lý chi nhánh hoặc quản trị viên mới được đăng ký thiết bị');

    const existing=await this.prisma.branchDevice.findUnique({
      where:{deviceCode:input.deviceCode},
      select:{id:true}
    });
    if(existing)throw new ConflictException('Mã thiết bị đã được sử dụng');

    const deviceToken=`a25dv_${randomBytes(32).toString('base64url')}`;
    try{
      const device=await this.prisma.branchDevice.create({
        data:{
          branchId:branch.id,
          deviceCode:input.deviceCode,
          deviceName:input.deviceName,
          deviceTokenHash:hashDeviceToken(deviceToken),
          registeredById:userId
        },
        select:{id:true,deviceCode:true,deviceName:true}
      });
      return{
        deviceId:device.id,
        deviceCode:device.deviceCode,
        deviceName:device.deviceName,
        branch:{id:branch.id,code:branch.code,name:branch.name},
        deviceToken
      };
    }catch(error){
      if(isUniqueConstraint(error))throw new ConflictException('Mã thiết bị đã được sử dụng');
      throw error;
    }
  }

  async current(rawToken:string|undefined){
    if(!rawToken)throw new UnauthorizedException('Thiết bị chưa được đăng ký');
    const device=await this.prisma.branchDevice.findUnique({
      where:{deviceTokenHash:hashDeviceToken(rawToken)},
      include:{branch:{select:{id:true,code:true,name:true}}}
    });
    if(!device||!device.isActive||device.revokedAt){
      throw new UnauthorizedException('Thiết bị không hợp lệ, đã bị vô hiệu hóa hoặc thu hồi');
    }

    const lastSeenAt=new Date();
    const updated=await this.prisma.branchDevice.updateMany({
      where:{id:device.id,isActive:true,revokedAt:null},data:{lastSeenAt}
    });
    if(updated.count!==1)throw new UnauthorizedException('Thiết bị đã bị vô hiệu hóa hoặc thu hồi');

    return{
      deviceId:device.id,
      deviceCode:device.deviceCode,
      deviceName:device.deviceName,
      branch:device.branch,
      lastSeenAt
    };
  }
}

export const branchDeviceTokenHash=hashDeviceToken;
