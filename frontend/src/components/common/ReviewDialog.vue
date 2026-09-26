<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ReviewResult } from '@/types'
import { REVIEW_RESULTS } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { identifyStore } from '@/stores/identifyStore'
import { recordStore } from '@/stores/recordStore'
import type { IdentifyLog } from '@/types'

const props = defineProps<{
  visible: boolean
  /** 待复核的鉴定结论 */
  log: IdentifyLog | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 复核提交完成 */
  reviewed: []
}>()

const identifyState = useStore(identifyStore)
const recordState = useStore(recordStore)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

/** 始终展示最新的 log 内容（退回再复核时复核历史会更新） */
const currentLog = computed(
  () => identifyState.logs.find((item) => item.id === props.log?.id) ?? props.log
)

const recordCode = computed(() => {
  const log = currentLog.value
  if (!log) return ''
  return recordState.records.find((item) => item.id === log.recordId)?.code ?? log.recordId
})

const form = reactive({
  reviewer: '',
  comment: '',
  result: '通过' as ReviewResult
})

watch(
  () => [props.visible, props.log?.id] as const,
  ([open]) => {
    if (open) {
      form.reviewer = ''
      form.comment = ''
      form.result = '通过'
    }
  },
  { immediate: true }
)

async function submit(): Promise<void> {
  const log = currentLog.value
  if (!log) return
  if (!form.reviewer.trim()) {
    ElMessage.warning('请填写复核人姓名')
    return
  }
  if (!form.comment.trim()) {
    ElMessage.warning('请填写复核意见')
    return
  }
  await identifyStore.getState().review(log.id, {
    reviewer: form.reviewer.trim(),
    comment: form.comment.trim(),
    result: form.result
  })
  ElMessage.success(
    form.result === '通过'
      ? `复核通过，${recordCode.value} 已移出待复核队列`
      : `已退回，${recordCode.value} 保留原结论并继续待复核`
  )
  dialogVisible.value = false
  emit('reviewed')
}
</script>

<template>
  <el-dialog v-model="dialogVisible" title="复核鉴定结论" width="620px" append-to-body>
    <template v-if="currentLog">
      <el-descriptions :column="2" border size="small" class="log-meta">
        <el-descriptions-item label="采集编号">{{ recordCode }}</el-descriptions-item>
        <el-descriptions-item label="结论日期">{{ currentLog.date }}</el-descriptions-item>
        <el-descriptions-item label="结论学名">{{ currentLog.conclusion }}</el-descriptions-item>
        <el-descriptions-item label="置信度">
          <el-tag type="warning" size="small" effect="plain">{{ currentLog.confidence }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="鉴定依据">{{ currentLog.basis }}</el-descriptions-item>
        <el-descriptions-item label="参考图鉴">
          {{ currentLog.referenceBook || '—' }} {{ currentLog.referencePage }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentLog.submitter" label="鉴定人">
          {{ currentLog.submitter }}
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="currentLog.reviews.some((item) => item.result === '退回')"
        type="error"
        :closable="false"
        show-icon
        class="returned-tip"
        title="该结论此前已被退回：原结论与历次意见均保留，通过后才会移出队列。"
      />

      <el-form label-width="84px" class="review-form">
        <el-form-item label="复核人" required>
          <el-input v-model="form.reviewer" placeholder="请填写复核人姓名" />
        </el-form-item>
        <el-form-item label="复核结果" required>
          <el-radio-group v-model="form.result">
            <el-radio-button v-for="item in REVIEW_RESULTS" :key="item" :value="item">
              {{ item }}
            </el-radio-button>
          </el-radio-group>
          <span class="result-hint muted">
            {{ form.result === '通过' ? '通过后移出待复核队列，结论留档' : '退回后保留原结论与意见，继续待复核' }}
          </span>
        </el-form-item>
        <el-form-item label="复核意见" required>
          <el-input
            v-model="form.comment"
            type="textarea"
            :rows="3"
            placeholder="请填写复核意见，如与图鉴页码、关键形态特征核对结果"
          />
        </el-form-item>
      </el-form>

      <div v-if="currentLog.reviews.length" class="history">
        <p class="history-title">历次复核（{{ currentLog.reviews.length }}）</p>
        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in currentLog.reviews"
            :key="index"
            :timestamp="`${item.date} · ${item.reviewer}`"
            placement="top"
          >
            <el-tag
              :type="item.result === '通过' ? 'success' : 'danger'"
              size="small"
              effect="plain"
            >
              {{ item.result }}
            </el-tag>
            <span class="history-comment">{{ item.comment || '—' }}</span>
          </el-timeline-item>
        </el-timeline>
      </div>
    </template>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">提交复核</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.log-meta {
  margin-bottom: 14px;
}
.returned-tip {
  margin-bottom: 12px;
}
.review-form {
  margin-top: 4px;
}
.result-hint {
  margin-left: 12px;
  font-size: 12px;
}
.history {
  margin-top: 8px;
  padding: 10px 12px 0;
  border-radius: 8px;
  background: #f7f5f0;
}
.history-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #4b5b50;
}
.history-comment {
  margin-left: 8px;
  font-size: 12px;
  color: #4b5b50;
}
</style>
