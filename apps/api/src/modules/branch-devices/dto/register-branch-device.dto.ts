import {Transform} from 'class-transformer';
import {IsString,IsUUID,Length,Matches,MaxLength} from 'class-validator';

export class RegisterBranchDeviceDto {
  @IsUUID()
  branchId!:string;

  @Transform(({value}:{value:unknown})=>typeof value==='string'?value.trim().toUpperCase():value)
  @IsString()
  @Length(3,64)
  @Matches(/^[A-Z0-9][A-Z0-9-]*$/,{message:'M? thi?t b? ch? ???c ch?a ch? in hoa, s? v? d?u g?ch ngang'})
  deviceCode!:string;

  @Transform(({value}:{value:unknown})=>typeof value==='string'?value.trim():value)
  @IsString()
  @Length(1,120)
  @MaxLength(120)
  deviceName!:string;
}
