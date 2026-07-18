import {Body,Controller,Get,Post,Req,Res,UseGuards} from '@nestjs/common';
import type {CookieOptions,Request,Response} from 'express';
import {SupabaseAuthGuard,type AuthRequest} from '../../common/guards/supabase-auth.guard';
import {BranchDevicesService} from './branch-devices.service';
import {RegisterBranchDeviceDto} from './dto/register-branch-device.dto';

const DEVICE_COOKIE='a25_device_token';
const cookieOptions:CookieOptions={
  httpOnly:true,
  secure:process.env.NODE_ENV==='production',
  sameSite:'lax',
  maxAge:365*24*60*60*1000,
  path:'/api/v1/branch-devices'
};

const clearCookieOptions:CookieOptions={
  httpOnly:true,
  secure:process.env.NODE_ENV==='production',
  sameSite:'lax',
  path:'/api/v1/branch-devices'
};

function cookieValue(request:Request,name:string){
  const encodedName=encodeURIComponent(name);
  for(const item of (request.headers.cookie??'').split(';')){
    const [key,...parts]=item.trim().split('=');
    if(key===encodedName)return decodeURIComponent(parts.join('='));
  }
  return undefined;
}

@Controller('branch-devices')
export class BranchDevicesController {
  constructor(private readonly branchDevices:BranchDevicesService){}

  @Post('register')
  @UseGuards(SupabaseAuthGuard)
  async register(@Req()request:AuthRequest,@Body()input:RegisterBranchDeviceDto,@Res({passthrough:true})response:Response){
    const result=await this.branchDevices.register(request.authUser!.id,input);
    response.cookie(DEVICE_COOKIE,result.deviceToken,cookieOptions);
    return{data:result,meta:{}};
  }

  @Get('current')
  async current(@Req()request:Request,@Res({passthrough:true})response:Response){
    const headerToken=typeof request.headers['x-device-token']==='string'?request.headers['x-device-token']:undefined;
    const authorization=request.headers.authorization?.match(/^Device\s+(.+)$/i)?.[1];
    const token=headerToken??authorization??cookieValue(request,DEVICE_COOKIE);
    try{
      const result=await this.branchDevices.current(token);
      return{data:result,meta:{}};
    }catch(error){
      response.clearCookie(DEVICE_COOKIE,clearCookieOptions);
      throw error;
    }
  }
}
