import {Module} from '@nestjs/common';import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';import {HandoversService} from './application/services/handovers.service';import {HandoversController} from './presentation/handovers.controller';
import {WorkSessionGuard} from '../../common/guards/work-session.guard';
@Module({controllers:[HandoversController],providers:[HandoversService,SupabaseAuthGuard,WorkSessionGuard],exports:[HandoversService]})export class HandoversModule{}
