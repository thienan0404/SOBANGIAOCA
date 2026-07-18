import {Module} from '@nestjs/common';
import {BranchDevicesModule} from '../branch-devices/branch-devices.module';
import {EmployeeAuthController} from './employee-auth.controller';
import {EmployeeAuthService} from './employee-auth.service';

@Module({imports:[BranchDevicesModule],controllers:[EmployeeAuthController],providers:[EmployeeAuthService]})
export class EmployeeAuthModule{}
