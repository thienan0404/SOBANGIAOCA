import {Module} from '@nestjs/common';
import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';
import {BranchDevicesController} from './branch-devices.controller';
import {BranchDevicesService} from './branch-devices.service';

@Module({
  controllers:[BranchDevicesController],
  providers:[BranchDevicesService,SupabaseAuthGuard]
})
export class BranchDevicesModule{}
