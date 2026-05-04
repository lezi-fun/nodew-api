export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatQuota = (value: string | number | bigint | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numeric = typeof value === 'bigint' ? Number(value) : Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat('zh-CN').format(numeric);
};

export const formatLatency = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${value} ms`;
};
