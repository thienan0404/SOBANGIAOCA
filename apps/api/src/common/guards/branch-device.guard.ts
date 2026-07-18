import {CanActivate,ExecutionContext,Injectable} from '@nestjs/common';
import {BranchDevicesService} from '../../modules/branch-devices/branch-devices.service';
import type {AuthRequest} from './supabase-auth.guard';

function cookieValue(cookieHeader:string|undefined,name:string){
  const encodedName=encodeURIComponent(name);
  for(const item of (cookieHeader??'').split(';')){
    const[key,...parts]=item.trim().split('=');
    if(key===encodedName)return decodeURIComponent(parts.join('='));
  }
  return undefined;
}

@Injectable()
export class BranchDeviceGuard implements CanActivate{
  constructor(private readonly devices:BranchDevicesService){}

  async canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest<AuthRequest>();
    const headerToken=typeof request.headers['x-device-token']==='string'?request.headers['x-device-token']:undefined;
    const deviceAuthorization=request.headers.authorization?.match(/^Device\s+(.+)$/i)?.[1];
    const token=headerToken??deviceAuthorization??cookieValue(request.headers.cookie,'a25_device_token');
    const current=await this.devices.current(token);
    request.branchDevice={deviceId:current.deviceId,branchId:current.branch.id,deviceCode:current.deviceCode};
    return true;
  }
}