import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { WorkSessionGuard } from "../../common/guards/work-session.guard";
import { RoomAttentionTagsController } from "./room-attention-tags.controller";
import { RoomAttentionTagsService } from "./room-attention-tags.service";

@Module({
  controllers: [RoomAttentionTagsController],
  providers: [RoomAttentionTagsService, SupabaseAuthGuard, WorkSessionGuard],
  exports: [RoomAttentionTagsService],
})
export class RoomAttentionTagsModule {}
