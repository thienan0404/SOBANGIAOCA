import {BadRequestException,ConflictException,Injectable,UnauthorizedException} from '@nestjs/common';
import {z} from 'zod';
import {PrismaService} from '../../infrastructure/database/prisma/prisma.service';

const employeeSchema=z.object({
  identifier:z.string().trim().min(3).max(80),
  pin:z.string().regex(/^\d{6}$/)
});
const startSchema=employeeSchema.extend({shiftInstanceId:z.string().uuid()});
const changePinSchema=z.object({
  identifier:z.string().trim().min(3).max(80),
  currentPin:z.string().regex(/^\d{6}$/),
  newPin:z.string().regex(/^\d{6}$/)
});

@Injectable()
export class EmployeeAuthService{
  constructor(private readonly prisma:PrismaService){}

  private employeeCode(identifier:string){
    return identifier.trim().toUpperCase()
      .replace(/^A25EMP:/,'')
      .replace(/^A25:\/\/EMPLOYEE\//,'')
      .trim();
  }

  private async branchContext(accountId:string,branchId:string){
    const[account,branch]=await Promise.all([
      this.prisma.profile.findUnique({
        where:{id:accountId},
        select:{id:true,fullName:true,email:true,isActive:true}
      }),
      this.prisma.branch.findUnique({
        where:{id:branchId},
        select:{id:true,name:true,code:true,address:true,organizationId:true}
      })
    ]);
    if(!account?.isActive)throw new UnauthorizedException('Tài khoản quản lý không hoạt động');
    if(!branch)throw new UnauthorizedException('Chi nhánh của thiết bị không hợp lệ');
    return{account,branch};
  }

  private async verifyPin(accountId:string,branchId:string,input:unknown){
    const parsed=employeeSchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Mã nhân viên và PIN 6 số chưa hợp lệ');

    const{account,branch}=await this.branchContext(accountId,branchId);
    const employee=await this.prisma.profile.findFirst({
      where:{
        employeeCode:{equals:this.employeeCode(parsed.data.identifier),mode:'insensitive'},
        isActive:true,
        memberships:{some:{branchId:branch.id,isActive:true}}
      },
      select:{id:true,fullName:true,email:true,employeeCode:true,mustChangePin:true}
    });
    if(!employee)throw new UnauthorizedException('Mã nhân viên hoặc PIN chưa chính xác');

    const[pinCheck]=await this.prisma.$queryRaw<Array<{valid:boolean}>>`
      select coalesce(pin_hash = extensions.crypt(${parsed.data.pin},pin_hash),false) as valid
      from profiles where id=${employee.id}::uuid
    `;
    if(!pinCheck?.valid)throw new UnauthorizedException('M\u00e3 nh\u00e2n vi\u00ean ho\u1eb7c PIN ch\u01b0a ch\u00ednh x\u00e1c');

    return{parsed:parsed.data,account,employee,branch};
  }

  async branch(accountId:string,branchId:string){
    const{account,branch}=await this.branchContext(accountId,branchId);
    const activeSession=await this.prisma.workSession.findFirst({
      where:{authenticatedBy:accountId,status:'ACTIVE'},
      include:{profile:true,branch:true,shift:true},
      orderBy:{actualStart:'desc'}
    });
    return{
      account:{id:account.id,fullName:account.fullName,email:account.email},
      branch,
      activeSession,
      serverTime:new Date().toISOString()
    };
  }

  async verifyEmployee(accountId:string,branchId:string,input:unknown){
    const{employee,branch}=await this.verifyPin(accountId,branchId,input);
    const now=new Date();
    const oneHourAhead=new Date(now.getTime()+60*60*1000);
    const assignments=await this.prisma.shiftAssignment.findMany({
      where:{profileId:employee.id,shift:{branchId:branch.id,startsAt:{lte:oneHourAhead},endsAt:{gte:now}}},
      include:{shift:{include:{branch:true}}},
      orderBy:{shift:{startsAt:'asc'}}
    });
    return{
      employee:{id:employee.id,fullName:employee.fullName,employeeCode:employee.employeeCode,mustChangePin:employee.mustChangePin},
      branch,
      assignments,
      serverTime:now.toISOString()
    };
  }

  async changePin(accountId:string,branchId:string,input:unknown){
    const parsed=changePinSchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('PIN phải gồm đúng 6 chữ số');
    if(parsed.data.newPin==='888888')throw new BadRequestException('PIN mới không được trùng PIN mặc định');
    if(parsed.data.newPin===parsed.data.currentPin)throw new BadRequestException('PIN mới phải khác PIN hiện tại');

    const{employee}=await this.verifyPin(accountId,branchId,{identifier:parsed.data.identifier,pin:parsed.data.currentPin});
    await this.prisma.$executeRaw`
      update profiles
      set pin_hash=extensions.crypt(${parsed.data.newPin},extensions.gen_salt('bf',12)),
          must_change_pin=false
      where id=${employee.id}::uuid
    `;
    return{changed:true};
  }

  async startSession(accountId:string,branchId:string,input:unknown){
    const parsed=startSchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Thông tin xác nhận ca chưa hợp lệ');

    const verified=await this.verifyPin(accountId,branchId,parsed.data);
    if(verified.employee.mustChangePin)
      throw new BadRequestException('Bạn phải đổi PIN mặc định trước khi xác nhận ca');
    const now=new Date();
    const oneHourAhead=new Date(now.getTime()+60*60*1000);
    const active=await this.prisma.workSession.findFirst({where:{profileId:verified.employee.id,status:'ACTIVE'}});
    if(active){
      if(active.branchId===verified.branch.id&&active.shiftInstanceId===parsed.data.shiftInstanceId)return active;
      throw new ConflictException('Nhân viên đang có một phiên làm việc khác chưa kết thúc');
    }

    const assignment=await this.prisma.shiftAssignment.findFirst({
      where:{
        profileId:verified.employee.id,
        shiftInstanceId:parsed.data.shiftInstanceId,
        shift:{branchId:verified.branch.id,startsAt:{lte:oneHourAhead},endsAt:{gte:now}}
      },
      include:{shift:true}
    });
    if(!assignment)throw new BadRequestException('Không tìm thấy lịch phân ca phù hợp với giờ thực tế');

    const differenceMinutes=Math.round((now.getTime()-assignment.shift.startsAt.getTime())/60000);
    const scheduleMatch=Math.abs(differenceMinutes)<=15?'ON_TIME':differenceMinutes<0?'EARLY':'LATE';
    return this.prisma.workSession.create({data:{
      organizationId:assignment.shift.organizationId,
      profileId:verified.employee.id,
      authenticatedBy:accountId,
      branchId:verified.branch.id,
      shiftInstanceId:assignment.shift.id,
      scheduleMatch,
      scheduledStart:assignment.shift.startsAt,
      actualStart:now
    }});
  }

  endSession(accountId:string){
    return this.prisma.workSession.updateMany({
      where:{authenticatedBy:accountId,status:'ACTIVE'},
      data:{status:'COMPLETED',endedAt:new Date()}
    });
  }
}
