import { prisma } from './prisma.js';

export type RatioMap = Record<string, number>;

const readRatioOption = async (key: string): Promise<RatioMap> => {
  const option = await prisma.systemOption.findUnique({
    where: { key },
    select: { value: true },
  });
  if (!option?.value) return {};
  try {
    const parsed = JSON.parse(option.value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: RatioMap = {};
    for (const [model, ratio] of Object.entries(parsed)) {
      if (typeof ratio === 'number' && ratio > 0) {
        result[model] = ratio;
      }
    }
    return result;
  } catch {
    return {};
  }
};

export const getModelRatios = () => readRatioOption('model_ratios');

export const getGroupRatios = () => readRatioOption('group_ratios');

export const getEffectiveModelRatio = async (model: string, groupRatio = 1): Promise<number> => {
  const modelRatios = await getModelRatios();
  const modelRatio = modelRatios[model] ?? 1;
  return groupRatio * modelRatio;
};

export const getGroupRatio = async (groupId: string | null | undefined): Promise<number> => {
  if (!groupId) return 1;
  const groupRatios = await getGroupRatios();
  if (Object.keys(groupRatios).length === 0) return 1;

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });
    return group ? (groupRatios[group.name] ?? 1) : 1;
  } catch {
    return 1;
  }
};
