<script setup lang="ts">
import { computed } from 'vue'
import type { IdentifyLog } from '@/types'
import { latestReview, statusView } from '@/utils/review'

const props = withDefaults(
  defineProps<{
    /** 最新鉴定结论；为 null 时展示「尚无鉴定结论」 */
    log: IdentifyLog | null | undefined
    size?: 'small' | 'default' | 'large'
    /** 是否在悬浮提示里展示最近一次复核人与意见 */
    showReview?: boolean
  }>(),
  { size: 'small', showReview: true }
)

const view = computed(() => (props.log ? statusView(props.log) : null))
const lastReview = computed(() => (props.log ? latestReview(props.log) : undefined))

const tooltip = computed(() => {
  if (!props.log || !view.value) return '该条目尚无鉴定结论'
  const lines = [view.value.description]
  if (props.showReview && lastReview.value) {
    lines.push(
      `最近复核：${lastReview.value.reviewer}（${lastReview.value.result} · ${lastReview.value.date}）${lastReview.value.comment ? ' ' + lastReview.value.comment : ''}`
    )
  }
  return lines.join('\n')
})
</script>

<template>
  <el-tooltip :content="tooltip" placement="top" :disabled="!showReview">
    <el-tag v-if="view" :type="view.type" :size="size" :effect="view.status === 'archived' ? 'plain' : 'dark'">
      {{ view.label }}
    </el-tag>
    <el-tag v-else type="warning" :size="size" effect="plain">尚无鉴定结论</el-tag>
  </el-tooltip>
</template>
