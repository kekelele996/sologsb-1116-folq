<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { IdentifyLog } from '@/types'
import {
  CAP_MARGINS,
  CAP_SHAPES,
  CAP_TEXTURES,
  FLESH_REACTIONS,
  GILL_ATTACHMENTS,
  GILL_DENSITIES,
  ID_BASES,
  ID_CONFIDENCES,
  SPORE_COLORS
} from '@/types'
import GillAttachmentTag from '@/components/common/GillAttachmentTag.vue'
import SporePrintSwatch from '@/components/common/SporePrintSwatch.vue'
import IdentifyStatusTag from '@/components/common/IdentifyStatusTag.vue'
import ReviewDialog from '@/components/common/ReviewDialog.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { EMPTY_CRITERIA, useCandidateMatch, type MatchCriteria } from '@/hooks/useCandidateMatch'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { identifyStore } from '@/stores/identifyStore'
import { pointStore } from '@/stores/pointStore'
import { identifyStatus, latestReview, statusView } from '@/utils/review'
import { uid } from '@/utils/id'

const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const identifyState = useStore(identifyStore)
const pointState = useStore(pointStore)

const criteria = reactive<MatchCriteria>({ ...EMPTY_CRITERIA })
const { candidates, hasCondition } = useCandidateMatch(
  computed(() => recordState.records),
  computed(() => sporeState.spores),
  computed(() => ({ ...criteria }))
)

const activeRecordId = ref('')
const active = computed(() => recordState.records.find((item) => item.id === activeRecordId.value) ?? null)

/** 新结论是否进入待复核：非高置信度一律入队，高置信度直接留档 */
const willNeedReview = computed(() => logForm.confidence !== '高')

/** 当前目标条目未结清的复核（仍在队列中的结论） */
const activePending = computed(() => {
  const recordId = active.value?.id
  return recordId ? identifyState.logs.find((item) => item.recordId === recordId && item.needReview) : undefined
})

/** 待复核队列：退回优先、退回次数多者优先、再按结论日期倒序 */
const pendingQueue = computed(() =>
  [...identifyState.logs]
    .filter((item) => item.needReview)
    .sort((a, b) => {
      const rank = (log: IdentifyLog): number => (identifyStatus(log) === 'returned' ? 1 : 0)
      if (rank(a) !== rank(b)) return rank(b) - rank(a)
      if (a.reviews.length !== b.reviews.length) return b.reviews.length - a.reviews.length
      return (b.date + b.id).localeCompare(a.date + a.id)
    })
)

const logForm = reactive({
  conclusion: '',
  basis: '形态特征' as IdentifyLog['basis'],
  referenceBook: '',
  referencePage: '',
  confidence: '中' as IdentifyLog['confidence'],
  submitter: ''
})

/** 复核对话框 */
const reviewVisible = ref(false)
const reviewTarget = ref<IdentifyLog | null>(null)

watch(
  () => [recordState.records.length, activeRecordId.value] as const,
  () => {
    if (!activeRecordId.value && recordState.records.length > 0) {
      activeRecordId.value = recordState.records[0].id
    }
  },
  { immediate: true }
)

function pointName(pointId: string): string {
  return pointState.points.find((point) => point.id === pointId)?.name ?? '未关联采集点'
}

function recordOf(recordId: string) {
  return recordState.records.find((item) => item.id === recordId) ?? null
}

function resetCriteria(): void {
  Object.assign(criteria, EMPTY_CRITERIA)
}

function pickCandidate(recordId: string, conclusion: string): void {
  activeRecordId.value = recordId
  logForm.conclusion = conclusion
  ElMessage.info('已把候选条目的暂定名填入结论，请核对后保存')
}

/** 依据候选条目生成学名草稿（暂定名去掉括号说明） */
function draftConclusion(tempName: string): string {
  return tempName.replace(/[（(].*?[)）]/g, '').trim()
}

const latestOf = (recordId: string): IdentifyLog | undefined =>
  identifyState.logs.find((item) => item.recordId === recordId)

async function saveLog(): Promise<void> {
  if (!active.value) {
    ElMessage.warning('请先在候选名录中选择要落结论的条目')
    return
  }
  if (!logForm.conclusion.trim()) {
    ElMessage.warning('请填写结论学名')
    return
  }
  // 有未结清复核时先提示已有待办，不再生成新的待复核记录
  const pending = identifyState.pendingOf(active.value.id)
  if (pending) {
    const view = statusView(pending)
    const last = latestReview(pending)
    await ElMessageBox.alert(
      `条目 ${active.value.code} 已有「${view.label}」结论：${pending.conclusion}（${pending.confidence}置信度）` +
        `${last ? `\n最近复核：${last.reviewer} · ${last.result} —— ${last.comment}` : '\n该结论尚未有人复核'}` +
        `\n请先在下方待复核队列中处理（通过或退回），再提交新鉴定。`,
      '该条目存在未结清复核',
      { type: 'warning', confirmButtonText: '去处理复核' }
    )
    return
  }
  const log: IdentifyLog = {
    id: uid('idf'),
    recordId: active.value.id,
    conclusion: logForm.conclusion.trim(),
    basis: logForm.basis,
    referenceBook: logForm.referenceBook.trim(),
    referencePage: logForm.referencePage.trim(),
    confidence: logForm.confidence,
    needReview: willNeedReview.value,
    submitter: logForm.submitter.trim(),
    date: new Date().toISOString().slice(0, 10),
    reviews: []
  }
  await identifyState.save(log)
  ElMessage.success(
    willNeedReview.value
      ? `${active.value.code} 已记录结论：${log.conclusion}（${log.confidence}置信度），已进入待复核队列`
      : `${active.value.code} 已记录结论：${log.conclusion}（高置信度），直接留档`
  )
  logForm.conclusion = ''
}

function openReview(log: IdentifyLog): void {
  reviewTarget.value = log
  reviewVisible.value = true
  // 复核队列里的条目同步到左侧目标，便于查看形态特征
  activeRecordId.value = log.recordId
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">鉴定工作页</h2>
        <p class="page-sub">
          左侧勾选观察到的形态特征与孢子印条件，右侧实时给出候选名录排序（着生方式与印色权重最高），确认后落鉴定结论；非高置信度自动进入待复核队列。
        </p>
      </div>
      <el-tag type="info" effect="plain">{{ hasCondition ? '已设条件，按匹配度排序' : '未设条件，按编号排序' }}</el-tag>
    </div>

    <el-card shadow="never" class="queue-card">
      <template #header>
        <div class="queue-head">
          <span>待复核队列</span>
          <el-tag :type="pendingQueue.length ? 'danger' : 'success'" size="small" effect="plain">
            {{ pendingQueue.length }} 条未结清
          </el-tag>
        </div>
      </template>
      <el-table v-if="pendingQueue.length" :data="pendingQueue" border stripe size="small">
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: IdentifyLog }">
            <IdentifyStatusTag :log="row" :show-review="false" />
          </template>
        </el-table-column>
        <el-table-column label="采集编号" width="150">
          <template #default="{ row }: { row: IdentifyLog }">
            <span class="mono">{{ recordOf(row.recordId)?.code ?? row.recordId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="conclusion" label="结论学名" min-width="150" />
        <el-table-column prop="confidence" label="置信度" width="80" />
        <el-table-column label="提交信息" width="160">
          <template #default="{ row }: { row: IdentifyLog }">
            <span class="muted">{{ row.submitter || '未署名' }} · {{ row.date }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近复核" min-width="220">
          <template #default="{ row }: { row: IdentifyLog }">
            <span v-if="latestReview(row)" class="last-review">
              <el-tag
                :type="latestReview(row)?.result === '通过' ? 'success' : 'danger'"
                size="small"
                effect="plain"
              >
                {{ latestReview(row)?.result }}
              </el-tag>
              <span class="muted">{{ latestReview(row)?.reviewer }}：{{ latestReview(row)?.comment }}</span>
            </span>
            <span v-else class="muted">尚未有人复核</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }: { row: IdentifyLog }">
            <el-button size="small" type="primary" plain @click="openReview(row)">
              {{ identifyStatus(row) === 'returned' ? '再次复核' : '去复核' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无待复核结论，高置信度结论会直接留档" :image-size="60" />
    </el-card>

    <div class="layout">
      <el-card shadow="never" class="criteria-card">
        <template #header>
          <div class="card-head">
            <span>特征勾选</span>
            <el-button link type="primary" size="small" @click="resetCriteria">重置</el-button>
          </div>
        </template>
        <el-form label-width="88px" size="small">
          <el-form-item label="着生方式">
            <el-select v-model="criteria.attachment" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in GILL_ATTACHMENTS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="孢子印">
            <el-select v-model="criteria.sporeColor" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="color in SPORE_COLORS" :key="color" :label="color" :value="color" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌盖形状">
            <el-select v-model="criteria.capShape" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_SHAPES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌盖边缘">
            <el-select v-model="criteria.capMargin" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_MARGINS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="表面质地">
            <el-select v-model="criteria.capTexture" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in CAP_TEXTURES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌褶密度">
            <el-select v-model="criteria.gillDensity" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in GILL_DENSITIES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="菌肉反应">
            <el-select v-model="criteria.fleshReaction" placeholder="不限" clearable style="width: 100%">
              <el-option v-for="item in FLESH_REACTIONS" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="关联树种">
            <el-input v-model="criteria.hostTree" placeholder="如 辽东栎" clearable />
          </el-form-item>
        </el-form>
        <div class="rule">
          <p>权重：着生方式 26 · 孢子印 22 · 菌盖形状 12 · 表面质地 10 · 菌褶密度 10 · 边缘 8 · 菌肉反应 8 · 树种 4</p>
          <p>印色与着生方式不一致时，若属于该印色的先验组合仍计半分。</p>
        </div>
      </el-card>

      <div class="right">
        <el-card shadow="never" class="candidate-card">
          <template #header>候选名录（按匹配度排序，共 {{ candidates.length }} 条）</template>
          <div class="candidate-list">
            <button
              v-for="item in candidates"
              :key="item.record.id"
              type="button"
              class="candidate"
              :class="{ active: activeRecordId === item.record.id }"
              @click="activeRecordId = item.record.id"
            >
              <div class="candidate-top">
                <span class="mono">{{ item.record.code }}</span>
                <span class="cand-name">{{ item.record.tempName || '未命名条目' }}</span>
                <span class="percent">{{ item.percent }}%</span>
              </div>
              <el-progress :percentage="item.percent" :show-text="false" :stroke-width="6" />
              <div class="candidate-tags">
                <GillAttachmentTag :attachment="item.record.attachment" />
                <SporePrintSwatch :color="item.spore?.color ?? null" :caption="`${item.record.capShape} · ${item.record.gillDensity}褶`" />
              </div>
              <div class="match-line">
                <span v-if="item.matched.length" class="hit">命中：{{ item.matched.join('、') }}</span>
                <span v-if="item.missed.length" class="miss">未命中：{{ item.missed.join('、') }}</span>
              </div>
              <div class="candidate-actions">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  @click.stop="pickCandidate(item.record.id, draftConclusion(item.record.tempName))"
                >
                  以该条为结论草稿
                </el-button>
                <template v-if="latestOf(item.record.id)">
                  <IdentifyStatusTag :log="latestOf(item.record.id)" />
                  <span class="muted">结论：{{ latestOf(item.record.id)?.conclusion }}</span>
                </template>
                <IdentifyStatusTag v-else :log="null" />
              </div>
            </button>
            <el-empty v-if="candidates.length === 0" description="暂无条目，先去图谱总览新建" />
          </div>
        </el-card>

        <el-card shadow="never" class="log-card">
          <template #header>
            记录鉴定结论
            <span v-if="active" class="muted"> · 目标条目 {{ active.code }}（{{ pointName(active.pointId) }}）</span>
          </template>
          <el-alert
            v-if="activePending"
            :title="`该条目已有${statusView(activePending).label}结论「${activePending.conclusion}」，请先在待复核队列结清后再提交新鉴定`"
            type="warning"
            :closable="false"
            show-icon
            class="pending-alert"
          >
            <div class="pending-alert-body">
              <span class="muted">
                {{ activePending.submitter || '未署名' }} 于 {{ activePending.date }} 提交 · {{ activePending.confidence }}置信度
              </span>
              <el-button size="small" type="warning" plain @click="openReview(activePending)">前往复核</el-button>
            </div>
          </el-alert>
          <el-form label-width="92px">
            <el-form-item label="结论学名" required>
              <el-input v-model="logForm.conclusion" placeholder="如 Lepista sordida" />
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="依据">
                  <el-select v-model="logForm.basis" style="width: 100%">
                    <el-option v-for="item in ID_BASES" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="置信度">
                  <el-select v-model="logForm.confidence" style="width: 100%">
                    <el-option v-for="item in ID_CONFIDENCES" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="14">
                <el-form-item label="参考图鉴">
                  <el-input v-model="logForm.referenceBook" placeholder="如 《菌物图鉴》" />
                </el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item label="页码">
                  <el-input v-model="logForm.referencePage" placeholder="如 P.145" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="鉴定人">
              <el-input v-model="logForm.submitter" placeholder="出结论的人，如 沈禾" />
            </el-form-item>
            <el-form-item label="流转规则">
              <el-tag :type="willNeedReview ? 'warning' : 'success'" size="small" effect="plain">
                {{ willNeedReview ? '中/低置信度：保存后进入待复核队列' : '高置信度：保存后直接留档' }}
              </el-tag>
              <span class="muted rule-hint">复核人通过后移出队列；退回则保留原结论与意见，继续待复核</span>
            </el-form-item>
            <div class="form-actions">
              <el-button type="primary" :disabled="Boolean(activePending)" @click="saveLog">保存鉴定结论</el-button>
            </div>
          </el-form>
        </el-card>
      </div>
    </div>

    <ReviewDialog v-model:visible="reviewVisible" :log="reviewTarget" />
  </div>
</template>

<style scoped>
.queue-card {
  border-radius: 12px;
  margin-bottom: 16px;
}
.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.last-review {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.last-review .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}
.criteria-card {
  width: 300px;
  border-radius: 12px;
}
.right {
  flex: 1 1 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.candidate-card,
.log-card {
  border-radius: 12px;
}
.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 460px;
  overflow: auto;
}
.candidate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e8e2d6;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.candidate.active {
  border-color: #c96f3a;
  box-shadow: 0 0 0 1px #c96f3a inset;
}
.candidate-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cand-name {
  font-size: 13px;
  font-weight: 600;
}
.percent {
  margin-left: auto;
  font-size: 13px;
  color: #c96f3a;
  font-weight: 600;
}
.candidate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.match-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.hit {
  color: #2f7a4d;
}
.miss {
  color: #a45b1f;
}
.candidate-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rule {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f5f0;
  font-size: 11px;
  color: #6f7d72;
  line-height: 1.7;
}
.rule p {
  margin: 0;
}
.pending-alert {
  margin-bottom: 12px;
}
.pending-alert-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}
.rule-hint {
  margin-left: 10px;
  font-size: 12px;
}
.form-actions {
  padding-left: 92px;
}
</style>
