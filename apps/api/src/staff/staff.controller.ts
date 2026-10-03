import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import {
  StaffAuthGuard,
  StaffRoles,
  type StaffContext,
} from '../auth/staff-auth.guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import {
  CreateStaffResponseDto,
  StaffResponseDto,
} from './dto/staff-response.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@ApiTags('vendor: staff')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({
  description:
    'not_staff | staff_disabled | vendor_suspended | branch_closed | forbidden_role | ' +
    'forbidden_branch | forbidden_role_change | cannot_modify_self',
})
@UseGuards(StaffAuthGuard)
@StaffRoles('vendor_admin', 'branch_manager')
@Controller('vendor/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  /** vendor_admin: all staff of the vendor. branch_manager: their branch only. */
  @Get()
  @ApiOkResponse({ type: [StaffResponseDto] })
  async list(
    @CurrentStaff() ctx: StaffContext,
    @Query() query: ListStaffQueryDto,
  ): Promise<StaffResponseDto[]> {
    return (await this.staff.list(ctx, query)).map(StaffResponseDto.from);
  }

  @Get(':id')
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiNotFoundResponse({ description: 'staff_not_found' })
  async get(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffResponseDto> {
    return StaffResponseDto.from(await this.staff.get(ctx, id));
  }

  /** Adds a staff member and emails them an invite to set their password. */
  @Post()
  @ApiCreatedResponse({ type: CreateStaffResponseDto })
  @ApiBadRequestResponse({
    description: 'branch_required | branch_not_allowed | invalid_branch',
  })
  @ApiConflictResponse({ description: 'email_taken | account_already_staff' })
  @ApiServiceUnavailableResponse({
    description: 'auth_admin_not_configured | auth_provider_error',
  })
  async create(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: CreateStaffDto,
  ): Promise<CreateStaffResponseDto> {
    const { staff, invited } = await this.staff.create(ctx, dto);
    return { ...StaffResponseDto.from(staff), invited };
  }

  /** Edit name / role / branch, or set status=disabled (soft delete) or active again. */
  @Patch(':id')
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiNotFoundResponse({ description: 'staff_not_found' })
  @ApiBadRequestResponse({
    description: 'branch_required | branch_not_allowed | invalid_branch',
  })
  async update(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffResponseDto> {
    return StaffResponseDto.from(await this.staff.update(ctx, id, dto));
  }
}
