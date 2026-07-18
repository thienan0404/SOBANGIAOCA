import {Module} from '@nestjs/common';import {BranchDevicesModule} from '../branch-devices/branch-devices.module';import {CatalogController} from './catalog.controller';
import {WorkSessionGuard} from '../../common/guards/work-session.guard';
@Module({imports:[BranchDevicesModule],controllers:[CatalogController],providers:[WorkSessionGuard]})export class CatalogModule{}
