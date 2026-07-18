import {Body,Controller,Get,Post,Req,UseGuards} from '@nestjs/common';
import type {AuthRequest} from '../../common/guards/supabase-auth.guard';
import {BranchDeviceGuard} from '../../common/guards/branch-device.guard';
import {EmployeeAuthService} from './employee-auth.service';

@Controller('auth')
@UseGuards(BranchDeviceGuard)
export class EmployeeAuthController{
  constructor(private readonly service:EmployeeAuthService){}

  @Get('branch-context')
  branch(@Req()request:AuthRequest){
    return this.service.branch(request.branchDevice!.registeredById,request.branchDevice!.branchId);
  }

  @Post('employee/verify')
  verifyEmployee(@Req()request:AuthRequest,@Body()body:unknown){
    return this.service.verifyEmployee(request.branchDevice!.registeredById,request.branchDevice!.branchId,body);
  }

  @Post('employee/change-pin')
  changePin(@Req()request:AuthRequest,@Body()body:unknown){
    return this.service.changePin(request.branchDevice!.registeredById,request.branchDevice!.branchId,body);
  }

  @Post('work-sessions')
  startSession(@Req()request:AuthRequest,@Body()body:unknown){
    return this.service.startSession(request.branchDevice!.registeredById,request.branchDevice!.branchId,body);
  }

  @Post('work-sessions/end')
  endSession(@Req()request:AuthRequest){
    return this.service.endSession(request.branchDevice!.registeredById);
  }
}
