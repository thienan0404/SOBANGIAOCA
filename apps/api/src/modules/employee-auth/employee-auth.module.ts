import {Module} from '@nestjs/common';
import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';
import {EmployeeAuthController} from './employee-auth.controller';
import {EmployeeAuthService} from './employee-auth.service';

@Module({controllers:[EmployeeAuthController],providers:[EmployeeAuthService,SupabaseAuthGuard]})
export class EmployeeAuthModule{}
