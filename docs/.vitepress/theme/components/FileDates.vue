<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

const { frontmatter, lang } = useData();

const dates = computed(() => frontmatter.value.fileDates as {
  created?: string;
  updated?: string;
} | undefined);
const isChinese = computed(() => lang.value.startsWith('zh'));
const locale = computed(() => isChinese.value ? 'zh-CN' : 'en-US');

const formatDate = (iso?: string) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso));
};
</script>

<template>
  <div v-if="dates?.created || dates?.updated" class="file-dates">
    <span v-if="dates.created">
      <strong>{{ isChinese ? '文件创建日期' : 'File created' }}</strong>
      <time :datetime="dates.created">{{ formatDate(dates.created) }}</time>
    </span>
    <span v-if="dates.updated">
      <strong>{{ isChinese ? '最后更新日期' : 'Last updated' }}</strong>
      <time :datetime="dates.updated">{{ formatDate(dates.updated) }}</time>
    </span>
  </div>
</template>
