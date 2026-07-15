import {CanActivate,ExecutionContext,Injectable,UnauthorizedException} from '@nestjs/common';
import {PrismaService} from '../../infrastructure/database/prisma/prisma.service';
import type {AuthRequest} from './supabase-auth.guard';

@Injectable()
export class WorkSessionGuard implements CanActivate{
  constructor(private readonly prisma:PrismaService){}

  async canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest<AuthRequest>();
    const branchAccountId=request.authUser?.id;
    const raw=request.headers['x-work-session-id'];
    const workSessionId=Array.isArray(raw)?raw[0]:raw;
    if(!branchAccountId||!workSessionId)
      throw new UnauthorizedException('Vui l\u00f2ng x\u00e1c nh\u1eadn ca l\u00e0m vi\u1ec7c');

    const session=await this.prisma.workSession.findFirst({
      where:{id:workSessionId,authenticatedBy:branchAccountId,status:'ACTIVE',endedAt:null}
    });
    if(!session)throw new UnauthorizedException('Phi\u00ean l\u00e0m vi\u1ec7c kh\u00f4ng h\u1ee3p l\u1ec7 ho\u1eb7c \u0111\u00e3 k\u1ebft th\u00fac');

    request.branchAccountId=branchAccountId;
    request.workSessionId=session.id;
    request.authUser={...request.authUser,id:session.profileId};
    return true;
  }
}
