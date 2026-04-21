import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateFeatureDto } from '../dto/create-feature.dto';
import { CreateSubscriptionPlaneDto } from '../dto/create-subscription-plane.dto';
import { QueryPlanDto } from '../dto/query-plan.dto';
import { UpdateFeatureDto } from '../dto/update-feature.dto';
import { UpdateSubscriptionPlaneDto } from '../dto/update-subscription-plane.dto';

@Injectable()
export class SubscriptionPlaneService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly planSortOrder: Record<string, number> = {
    FREE: 0,
    STARTER: 1,
    STANDARD: 2,
    PRO: 3,
    ENTERPRISE: 4,
    CUSTOM: 5,
  };

  // ==================== PLAN OPERATIONS ====================

  @HandleError('Error creating subscription plan')
  async createSubscriptionPlane(
    createSubscriptionPlaneDto: CreateSubscriptionPlaneDto,
  ) {
    const { name, price, isCustom, maxSpace, minSpace, featureIds } =
      createSubscriptionPlaneDto;

    // -------------- Check if plan name already exists -------------
    const existingPlan = await this.prisma.client.plan.findUnique({
      where: { name },
    });

    if (existingPlan) {
      throw new ConflictException(`Plan with name "${name}" already exists`);
    }

    // -----------------  If featureIds provided, verify they exist -------------------
    if (featureIds && featureIds.length > 0) {
      const features = await this.prisma.client.feature.findMany({
        where: { id: { in: featureIds } },
      });

      if (features.length !== featureIds.length) {
        throw new BadRequestException('Some feature IDs are invalid');
      }
    }

    // ---------------- Create plan with features -----------------
    const plan = await this.prisma.client.plan.create({
      data: {
        name,
        price,
        isCustom: isCustom ?? false,
        maxSpace: maxSpace ?? '',
        minSpace: minSpace ?? '',
        features: featureIds
          ? {
              create: featureIds.map((featureId) => ({
                feature: {
                  connect: { id: featureId },
                },
              })),
            }
          : undefined,
      },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    return {
      ...plan,
      features: plan.features.map((pf: any) => pf.feature),
    };
  }

  // ------------------ get all plans with pagination and search----------------------
  @HandleError('Error fetching subscription plans')
  async findAll(query: QueryPlanDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [plans, total] = await Promise.all([
      this.prisma.client.plan.findMany({
        where,
        include: {
          features: {
            include: {
              feature: true,
            },
          },
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
      }),
      this.prisma.client.plan.count({ where }),
    ]);

    const sortedPlans = [...plans].sort((leftPlan, rightPlan) => {
      const leftOrder =
        this.planSortOrder[leftPlan.name] ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        this.planSortOrder[rightPlan.name] ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return leftPlan.createdAt.getTime() - rightPlan.createdAt.getTime();
    });

    const paginatedPlans = sortedPlans.slice(skip, skip + limit);

    return {
      data: paginatedPlans.map((plan: any) => ({
        ...plan,
        features: plan.features.map((pf: any) => pf.feature),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------- error fetching single plan is handled in controller to provide more specific error message ----------
  @HandleError('Error fetching subscription plan')
  async findOne(id: string) {
    const plan = await this.prisma.client.plan.findUnique({
      where: { id },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }

    return {
      ...plan,
      features: plan.features.map((pf: any) => pf.feature),
    };
  }

  @HandleError('Error updating subscription plan')
  async update(
    id: string,
    updateSubscriptionPlaneDto: UpdateSubscriptionPlaneDto,
  ) {
    const { name, price, isCustom, maxSpace, minSpace, featureIds } =
      updateSubscriptionPlaneDto;

    // Check if plan exists
    const existingPlan = await this.prisma.client.plan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }

    // Check if new name conflicts with another plan
    if (name && name !== existingPlan.name) {
      const nameConflict = await this.prisma.client.plan.findUnique({
        where: { name },
      });

      if (nameConflict) {
        throw new ConflictException(`Plan with name "${name}" already exists`);
      }
    }

    // If featureIds provided, verify they exist
    if (featureIds && featureIds.length > 0) {
      const features = await this.prisma.client.feature.findMany({
        where: { id: { in: featureIds } },
      });

      if (features.length !== featureIds.length) {
        throw new BadRequestException('Some feature IDs are invalid');
      }
    }

    // -----------Update plan------------------
    const plan = await this.prisma.client.plan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(price && { price }),
        ...(isCustom !== undefined && { isCustom }),
        ...(minSpace && { minSpace }),
        ...(maxSpace && { maxSpace }),
        // ...(spaceLimit !== undefined && { spaceLimit }),
        ...(featureIds && {
          features: {
            deleteMany: {},
            create: featureIds.map((featureId) => ({
              feature: {
                connect: { id: featureId },
              },
            })),
          },
        }),
      },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    return {
      ...plan,
      features: plan.features.map((pf: any) => pf.feature),
    };
  }

  @HandleError('Error deleting subscription plan')
  async remove(id: string) {
    // --------------Check if plan exists-----------------
    const plan = await this.prisma.client.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }

    // -------------Check if plan has active subscriptions -------------------
    if (plan._count.subscriptions > 0) {
      throw new ConflictException(
        `Cannot delete plan with active subscriptions. Found ${plan._count.subscriptions} subscription(s).`,
      );
    }

    await this.prisma.client.plan.delete({
      where: { id },
    });

    return { message: `Plan "${plan.name}" deleted successfully` };
  }

  // ==================== FEATURE OPERATIONS ====================

  @HandleError('Error creating feature')
  async createFeature(createFeatureDto: CreateFeatureDto) {
    const { name } = createFeatureDto;

    const existingFeature = await this.prisma.client.feature.findUnique({
      where: { name },
    });

    if (existingFeature) {
      throw new ConflictException(`Feature with name "${name}" already exists`);
    }

    return this.prisma.client.feature.create({
      data: { name },
    });
  }

  // -----------get all features is admin only endpoint----------------------
  @HandleError('Error fetching features')
  async findAllFeatures() {
    const features = await this.prisma.client.feature.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return features;
  }
  //  -------------- get single feature------------------
  @HandleError('Error fetching feature')
  async findOneFeature(id: string) {
    const feature = await this.prisma.client.feature.findUnique({
      where: { id },
      include: {
        plans: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID "${id}" not found`);
    }

    return feature;
  }

  // --------- update feature ---------------
  @HandleError('Error updating feature')
  async updateFeature(id: string, updateFeatureDto: UpdateFeatureDto) {
    const { name } = updateFeatureDto;

    const existingFeature = await this.prisma.client.feature.findUnique({
      where: { id },
    });

    if (!existingFeature) {
      throw new NotFoundException(`Feature with ID "${id}" not found`);
    }

    if (name && name !== existingFeature.name) {
      const nameConflict = await this.prisma.client.feature.findUnique({
        where: { name },
      });

      if (nameConflict) {
        throw new ConflictException(
          `Feature with name "${name}" already exists`,
        );
      }
    }

    return this.prisma.client.feature.update({
      where: { id },
      data: { ...(name && { name }) },
    });
  }

  // ------- delete feature in only admin allowed-----------------

  @HandleError('Error deleting feature')
  async removeFeature(id: string) {
    const feature = await this.prisma.client.feature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID "${id}" not found`);
    }
    // -------- user is plane feature, so can not deleted it , first check if feature is associated with any plan-------------
    const plansWithFeature = await this.prisma.client.planFeature.findMany({
      where: { featureId: id },
    });

    if (plansWithFeature.length > 0) {
      throw new ConflictException(
        `Cannot delete feature associated with ${plansWithFeature.length} plan(s). Please remove the feature from those plans first.`,
      );
    }

    await this.prisma.client.feature.delete({
      where: { id },
    });

    return { message: `Feature "${feature.name}" deleted successfully` };
  }
}
