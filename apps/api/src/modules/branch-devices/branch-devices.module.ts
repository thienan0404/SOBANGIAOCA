import {Module} from '@nestjs/common';
import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';
import {BranchDeviceGuard} from '../../common/guards/branch-device.guard';
import {BranchDevicesController} from './branch-devices.controller';
import {BranchDevicesService} from './branch-devices.service';

@Module({
  controllers:[BranchDevicesController],
  providers:[BranchDevicesService,SupabaseAuthGuard,BranchDeviceGuard],
  exports:[BranchDevicesService,BranchDeviceGuard]
})
export class BranchDevicesModule{}
