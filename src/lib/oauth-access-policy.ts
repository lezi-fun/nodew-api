type OAuthAccessCondition = {
  field: string;
  op: string;
  value?: unknown;
};

type OAuthAccessPolicy = {
  logic: 'and' | 'or';
  conditions: OAuthAccessCondition[];
  groups: OAuthAccessPolicy[];
};

export type OAuthAccessPolicyFailure = {
  field: string;
  op: string;
  expected: unknown;
  current: unknown;
};

const supportedAccessPolicyOps = new Set([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'contains',
  'not_contains',
  'exists',
  'not_exists',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizePolicyOp = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeAccessCondition = (input: unknown, index: number): OAuthAccessCondition => {
  if (!isRecord(input)) {
    throw new Error(`condition[${index}] must be an object`);
  }

  const field = typeof input.field === 'string' ? input.field.trim() : '';
  if (!field) {
    throw new Error(`condition[${index}].field is required`);
  }

  const op = normalizePolicyOp(input.op ?? input.operator);
  if (!supportedAccessPolicyOps.has(op)) {
    throw new Error(`condition[${index}].op is unsupported: ${op || '<empty>'}`);
  }

  if ((op === 'in' || op === 'not_in') && !Array.isArray(input.value)) {
    throw new Error(`condition[${index}].value must be an array for op ${op}`);
  }

  return {
    field,
    op,
    value: input.value,
  };
};

const normalizeAccessPolicy = (input: unknown): OAuthAccessPolicy => {
  if (!isRecord(input)) {
    throw new Error('access policy must be an object');
  }

  if ('field' in input) {
    return {
      logic: 'and',
      conditions: [normalizeAccessCondition(input, 0)],
      groups: [],
    };
  }

  const logicInput = typeof input.logic === 'string' ? input.logic.trim().toLowerCase() : '';
  const logic = logicInput || 'and';

  if (logic !== 'and' && logic !== 'or') {
    throw new Error(`unsupported policy logic: ${logic}`);
  }

  const conditions = Array.isArray(input.conditions)
    ? input.conditions.map((condition, index) => normalizeAccessCondition(condition, index))
    : [];
  const groups = Array.isArray(input.groups)
    ? input.groups.map((group) => normalizeAccessPolicy(group))
    : [];

  if (conditions.length === 0 && groups.length === 0) {
    throw new Error('access policy requires at least one condition or group');
  }

  return {
    logic,
    conditions,
    groups,
  };
};

export const parseOAuthAccessPolicy = (raw: string): OAuthAccessPolicy | null => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  return normalizeAccessPolicy(JSON.parse(trimmed));
};

export const validateOAuthAccessPolicy = (raw: string) => {
  parseOAuthAccessPolicy(raw);
};

const pathToSegments = (path: string) =>
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const readJsonPath = (source: unknown, path: string): { exists: boolean; value: unknown } => {
  const segments = pathToSegments(path);
  let current = source;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { exists: false, value: undefined };
      }

      current = current[index];
      continue;
    }

    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { exists: false, value: undefined };
    }

    current = current[segment];
  }

  return { exists: true, value: current };
};

export const readJsonPathString = (source: unknown, path: string) => {
  const result = readJsonPath(source, path);

  if (!result.exists || result.value === null || result.value === undefined) {
    return '';
  }

  if (['string', 'number', 'boolean', 'bigint'].includes(typeof result.value)) {
    return String(result.value).trim();
  }

  return '';
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
};

const compareAny = (left: unknown, right: unknown) => {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }

  const leftString = String(left ?? '').trim();
  const rightString = String(right ?? '').trim();
  return leftString === rightString ? 0 : leftString < rightString ? -1 : 1;
};

const valueInArray = (current: unknown, expected: unknown) =>
  Array.isArray(expected) && expected.some((item) => compareAny(current, item) === 0);

const containsValue = (current: unknown, expected: unknown) => {
  if (typeof current === 'string') {
    return current.includes(String(expected ?? '').trim());
  }

  if (Array.isArray(current)) {
    return current.some((item) => compareAny(item, expected) === 0);
  }

  return false;
};

const evaluateAccessCondition = (
  source: unknown,
  condition: OAuthAccessCondition,
): { allowed: boolean; failure: OAuthAccessPolicyFailure } => {
  const result = readJsonPath(source, condition.field);
  const current = result.exists ? result.value : null;
  const failure = {
    field: condition.field,
    op: condition.op,
    expected: condition.value,
    current,
  };

  switch (condition.op) {
    case 'exists':
      return { allowed: result.exists, failure };
    case 'not_exists':
      return { allowed: !result.exists, failure };
    case 'eq':
      return { allowed: compareAny(current, condition.value) === 0, failure };
    case 'ne':
      return { allowed: compareAny(current, condition.value) !== 0, failure };
    case 'gt':
      return { allowed: compareAny(current, condition.value) > 0, failure };
    case 'gte':
      return { allowed: compareAny(current, condition.value) >= 0, failure };
    case 'lt':
      return { allowed: compareAny(current, condition.value) < 0, failure };
    case 'lte':
      return { allowed: compareAny(current, condition.value) <= 0, failure };
    case 'in':
      return { allowed: valueInArray(current, condition.value), failure };
    case 'not_in':
      return { allowed: !valueInArray(current, condition.value), failure };
    case 'contains':
      return { allowed: containsValue(current, condition.value), failure };
    case 'not_contains':
      return { allowed: !containsValue(current, condition.value), failure };
    default:
      return { allowed: false, failure };
  }
};

export const evaluateOAuthAccessPolicy = (
  source: unknown,
  policy: OAuthAccessPolicy | null,
): { allowed: true; failure?: undefined } | { allowed: false; failure: OAuthAccessPolicyFailure } => {
  if (!policy) {
    return { allowed: true };
  }

  if (policy.logic === 'or') {
    let firstFailure: OAuthAccessPolicyFailure | null = null;

    for (const condition of policy.conditions) {
      const result = evaluateAccessCondition(source, condition);
      if (result.allowed) {
        return { allowed: true };
      }
      firstFailure ??= result.failure;
    }

    for (const group of policy.groups) {
      const result = evaluateOAuthAccessPolicy(source, group);
      if (result.allowed) {
        return { allowed: true };
      }
      firstFailure ??= result.failure;
    }

    return { allowed: false, failure: firstFailure ?? { field: '', op: '', expected: null, current: null } };
  }

  for (const condition of policy.conditions) {
    const result = evaluateAccessCondition(source, condition);
    if (!result.allowed) {
      return { allowed: false, failure: result.failure };
    }
  }

  for (const group of policy.groups) {
    const result = evaluateOAuthAccessPolicy(source, group);
    if (!result.allowed) {
      return { allowed: false, failure: result.failure };
    }
  }

  return { allowed: true };
};

export const formatOAuthAccessDeniedMessage = (
  template: string,
  providerName: string,
  source: unknown,
  failure?: OAuthAccessPolicyFailure,
) => {
  let message = template.trim();

  if (!message) {
    return 'Access denied: account does not meet this provider access requirements.';
  }

  const replacements = new Map([
    ['{{provider}}', providerName],
    ['{{field}}', failure?.field ?? ''],
    ['{{op}}', failure?.op ?? ''],
    ['{{required}}', String(failure?.expected ?? '')],
    ['{{current}}', String(failure?.current ?? '')],
  ]);

  for (const [token, value] of replacements) {
    message = message.replaceAll(token, value);
  }

  message = message.replaceAll(/\{\{current\.([^}]+)\}\}/g, (_, path: string) =>
    readJsonPathString(source, path.trim()));

  return message.trim() || 'Access denied: account does not meet this provider access requirements.';
};
