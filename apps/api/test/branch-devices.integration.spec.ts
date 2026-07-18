jest.mock('jose',()=>({createRemoteJWKSet:jest.fn(),jwtVerify:jest.fn()}));

import {CanActivate,ExecutionContext,ValidationPipe} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {SupabaseAuthGuard,type AuthRequest} from '../src/common/guards/supabase-auth.guard';
import {RequestIdInterceptor} from '../src/common/interceptors/request-id.interceptor';
import {BranchDevicesController} from '../src/modules/branch-devices/branch-devices.controller';
import {BranchDevicesService} from '../src/modules/branch-devices/branch-devices.service';

const registered={
  deviceId:'a3b40f83-e914-444a-bbaf-027ea1e70f6c',
  deviceCode:'45PCT-FRONTDESK-01',
  deviceName:'Quầy lễ tân chính',
  branch:{id:'6f0df350-9662-4c37-9a93-55e4c73f8326',code:'45PCT',name:'45 Phan Chu Trinh'},
  deviceToken:'a25dv_integration-token'
};

class AuthGuardStub implements CanActivate{
  canActivate(context:ExecutionContext){
    context.switchToHttp().getRequest<AuthRequest>().authUser={id:'manager-id'};
    return true;
  }
}

describe('branch device API integration',()=>{
  const service={register:jest.fn(),current:jest.fn()};
  let app:import('@nestjs/common').INestApplication;

  beforeAll(async()=>{
    service.register.mockResolvedValue(registered);
    service.current.mockResolvedValue({...registered,lastSeenAt:new Date()});
    const module=await Test.createTestingModule({
      controllers:[BranchDevicesController],
      providers:[{provide:BranchDevicesService,useValue:service},SupabaseAuthGuard]
    }).overrideGuard(SupabaseAuthGuard).useClass(AuthGuardStub).compile();
    app=module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true}));
    app.useGlobalInterceptors(new RequestIdInterceptor());
    await app.init();
  });

  afterAll(async()=>app.close());

  it('registers through the endpoint and stores the token in an HttpOnly cookie',async()=>{
    const response=await request(app.getHttpServer())
      .post('/api/v1/branch-devices/register')
      .send({branchId:registered.branch.id,deviceCode:registered.deviceCode,deviceName:registered.deviceName})
      .expect(201);
    expect(response.body).toMatchObject({data:{deviceId:registered.deviceId,deviceToken:registered.deviceToken},meta:{}});
    expect(response.body.requestId).toEqual(expect.any(String));
    const cookie=response.headers['set-cookie']?.[0];
    expect(cookie).toContain('a25_device_token=');
    expect(cookie).toContain('HttpOnly');
  });

  it('reads the persisted cookie on the current endpoint',async()=>{
    const response=await request(app.getHttpServer())
      .get('/api/v1/branch-devices/current')
      .set('Cookie',`a25_device_token=${encodeURIComponent(registered.deviceToken)}`)
      .expect(200);
    expect(service.current).toHaveBeenCalledWith(registered.deviceToken);
    expect(response.body.data.branch.code).toBe('45PCT');
  });
});
