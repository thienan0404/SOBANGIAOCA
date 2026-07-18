import {Module} from '@nestjs/common';import {BranchDevicesModule} from '../branch-devices/branch-devices.module';import {HandoversService} from './application/services/handovers.service';import {HandoversController} from './presentation/handovers.controller';
import {WorkSessionGuard} from '../../common/guards/work-session.guard';
@Module({imports:[BranchDevicesModule],controllers:[HandoversController],providers:[HandoversService,WorkSessionGuard],exports:[HandoversService]})export class HandoversModule{}
