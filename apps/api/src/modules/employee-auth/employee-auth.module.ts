import {Module} from '@nestjs/common';
import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';
import {BranchDevicesModule} from '../branch-devices/branch-devices.module';
import {EmployeeAuthController} from './employee-auth.controller';
import {EmployeeAuthService} from './employee-auth.service';

@Module({imports:[BranchDevicesModule],controllers:[EmployeeAuthController],providers:[EmployeeAuthService,SupabaseAuthGuard]})
export class EmployeeAuthModule{}
