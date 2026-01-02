<template>
  <div class="chart-preview">
    <!-- Configuration Panel -->
    <div class="config-panel">
      <van-collapse v-model="activeNames">
        <van-collapse-item title="数据配置 / Data Configuration" name="data">
          <!-- Data Visibility Control -->
          <!-- Data Visibility Control -->
          <div class="data-controls">
            <van-button
              size="small"
              icon="eye-o"
              block
              @click="showDataDialog = true"
            >
              查看源数据 / View Source Data
            </van-button>
          </div>

          <van-dialog
            v-model:show="showDataDialog"
            title="数据预览 / Data Preview"
            width="80%"
            :showConfirmButton="false"
            closeOnClickOverlay
          >
            <div class="data-table-container">
              <table
                class="data-table"
                v-if="dataStore.parsedData.value.length"
              >
                <thead>
                  <tr>
                    <th v-for="h in dataStore.headers.value" :key="h">
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Only show first 500 rows for performance if needed, but requirements imply full preview or at least table view -->
                  <tr v-for="(row, i) in previewData" :key="i">
                    <td v-for="h in dataStore.headers.value" :key="h + i">
                      {{ row[h] }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="no-data">无数据 / No Data</div>
            </div>
          </van-dialog>

          <!-- Data Input -->
          <van-field
            v-if="showCsvPreview"
            v-model="csvInput"
            rows="3"
            autosize
            label="CSV Data"
            type="textarea"
            placeholder="Paste CSV here (Header required)"
          />
          <div class="action-buttons">
            <input
              type="file"
              ref="fileInputRef"
              accept=".csv"
              style="display: none"
              @change="handleFileUpload"
            />
            <van-button size="small" type="primary" @click="triggerFileUpload">
              导入 CSV / Import CSV
            </van-button>
            <van-button
              size="small"
              plain
              type="primary"
              @click="handleDataLoad"
              >解析数据 / Parse CSV</van-button
            >
            <van-button size="small" plain type="primary" @click="loadDemo"
              >加载示例 / Load Demo</van-button
            >
          </div>

          <div v-if="dataStore.headers.value.length > 0" class="mapping-config">
            <van-divider>图表设置 / Chart Settings</van-divider>

            <!-- Global Chart Type -->
            <div class="config-row">
              <span class="label">图表类型:</span>
              <van-radio-group
                v-model="dataStore.chartType.value"
                direction="horizontal"
              >
                <van-radio name="line">折线图</van-radio>
                <van-radio name="bar">柱状图</van-radio>
                <van-radio name="scatter">散点图</van-radio>
                <van-radio name="pie">饼图</van-radio>
              </van-radio-group>
            </div>

            <!-- X Axis -->
            <div class="config-row" v-if="dataStore.chartType.value !== 'pie'">
              <span class="label">X轴字段:</span>
              <select
                v-model="dataStore.xAxisField.value"
                class="native-select"
              >
                <option
                  v-for="h in dataStore.headers.value"
                  :key="h"
                  :value="h"
                >
                  {{ h }}
                </option>
              </select>
            </div>

            <!-- Series Selection -->
            <div class="config-row series-config">
              <span class="label">系列 (Series):</span>
              <div class="series-list">
                <div
                  v-for="h in availableSeriesFields"
                  :key="h"
                  class="series-item"
                >
                  <div class="series-item-header">
                    <input
                      type="checkbox"
                      :checked="isSeriesSelected(h)"
                      @change="(e) => toggleSeries(h, (e.target as HTMLInputElement).checked)"
                    />
                    <span>{{ h }}</span>
                  </div>

                  <div
                    v-if="
                      isSeriesSelected(h) && dataStore.chartType.value !== 'pie'
                    "
                    class="series-options"
                  >
                    <label>
                      <input
                        type="checkbox"
                        :checked="getSeriesYAxis(h) === 1"
                        @change="(e) => updateSeriesAxis(h, (e.target as HTMLInputElement).checked)"
                      />
                      右轴 (Right Axis)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </van-collapse-item>
      </van-collapse>
    </div>

    <!-- Chart Display -->
    <div class="chart-wrapper">
      <div ref="chartDom" class="chart-container"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, markRaw, computed } from "vue";
import * as echarts from "echarts";
import { useThemeStore } from "../stores/theme";
import { useGlobalDataStore } from "../stores/data";
import { useI18n } from "vue-i18n";

// Store interaction
const themeStore = useThemeStore();
const dataStore = useGlobalDataStore();
const { locale } = useI18n();

// UI State
const activeNames = ref(["data"]);
const csvInput = ref("");
const showCsvPreview = ref(false); // Kept for legacy support if needed, but UI replaced
const showDataDialog = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const previewData = computed(() => {
  return dataStore.parsedData.value.slice(0, 100); // Limit to 100 rows for view per common table limits
});
const chartDom = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

// Methods
const triggerFileUpload = () => {
  fileInputRef.value?.click();
};

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        csvInput.value = content;
        // Auto process
        handleDataLoad();
        // Hide preview if too large
        if (content.split("\n").length > 50) {
          showCsvPreview.value = false;
        } else {
          showCsvPreview.value = true;
        }
      }
    };
    reader.readAsText(file);
  }
  // Reset input so same file can be selected again
  target.value = "";
};

// Computed
const availableSeriesFields = computed(() => {
  return dataStore.headers.value.filter(
    (h) => h !== dataStore.xAxisField.value
  );
});

// Methods
const loadDemo = () => {
  dataStore.loadDemoData();
  csvInput.value = dataStore.rawCsv.value;
  // Demo data is large, hide it by default to avoid lag
  showCsvPreview.value = false;
};

const handleDataLoad = () => {
  dataStore.processCsv(csvInput.value);
};

const isSeriesSelected = (field: string) => {
  return !!dataStore.seriesConfigs.value.find((s) => s.field === field);
};

const toggleSeries = (field: string, checked: boolean) => {
  if (checked) {
    dataStore.addSeries(field);
  } else {
    const idx = dataStore.seriesConfigs.value.findIndex(
      (s) => s.field === field
    );
    if (idx !== -1) dataStore.removeSeries(idx);
  }
};

const getSeriesYAxis = (field: string) => {
  const s = dataStore.seriesConfigs.value.find((s) => s.field === field);
  return s ? s.yAxisIndex : 0;
};

const updateSeriesAxis = (field: string, isRight: boolean) => {
  const idx = dataStore.seriesConfigs.value.findIndex((s) => s.field === field);
  if (idx !== -1) {
    dataStore.updateSeries(idx, { yAxisIndex: isRight ? 1 : 0 });
  }
};

// Chart Generation Logic
const getChartOption = () => {
  const d = dataStore;
  if (d.parsedData.value.length === 0) return {};

  const isPie = d.chartType.value === "pie";

  // Base Option
  const option: any = {
    tooltip: {
      trigger: isPie ? "item" : "axis",
      axisPointer: { type: "shadow" }, // Better for mixed charts
    },
    legend: {},
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    dataset: {
      source: d.parsedData.value,
    },
  };

  if (isPie) {
    option.xAxis = undefined;
    option.yAxis = undefined;
    option.series = d.seriesConfigs.value.map((s) => ({
      type: "pie",
      name: s.name,
      encode: {
        itemName: d.xAxisField.value,
        value: s.field,
      },
      radius: "50%",
    }));
  } else {
    option.xAxis = {
      type: "category",
      data: d.parsedData.value.map((row) => row[d.xAxisField.value]),
    };

    // Check for Dual Axis
    const hasRightAxis = d.seriesConfigs.value.some((s) => s.yAxisIndex === 1);

    option.yAxis = [{ type: "value", name: "Left Axis" }];
    if (hasRightAxis) {
      option.yAxis.push({
        type: "value",
        name: "Right Axis",
        position: "right",
      });
    }

    option.series = d.seriesConfigs.value.map((s) => ({
      type: d.chartType.value,
      name: s.name,
      yAxisIndex: s.yAxisIndex,
      data: d.parsedData.value.map((row) => row[s.field]),
    }));
  }

  return option;
};

// Update Chart
// Debounce function
function debounce(fn: Function, delay: number) {
  let timer: any = null;
  return function (...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const updateChart = () => {
  if (chartInstance) {
    chartInstance.dispose();
  }

  if (!chartDom.value) return;

  // Register theme
  const currentTheme = themeStore.getEChartsTheme();
  const themeId = "customized";
  echarts.registerTheme(themeId, currentTheme);

  const chartLocale = locale.value === "zh" ? "ZH" : "EN";

  chartInstance = markRaw(
    echarts.init(chartDom.value, themeId, {
      locale: chartLocale,
    })
  );

  const option = getChartOption();
  chartInstance.setOption(option);
};

const debouncedUpdate = debounce(updateChart, 200);

// Expose updateCharts for parent if needed (ThemePanel calls this)
defineExpose({
  updateCharts: debouncedUpdate,
});

// Lifecycle
onMounted(() => {
  // If no data, load demo first so user sees something
  if (dataStore.parsedData.value.length === 0) {
    loadDemo();
  } else {
    debouncedUpdate();
  }

  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  chartInstance?.dispose();
});

function handleResize() {
  chartInstance?.resize();
}

// Watches
// Watch data changes
watch(
  [
    dataStore.parsedData,
    dataStore.chartType,
    dataStore.xAxisField,
    dataStore.seriesConfigs,
  ],
  debouncedUpdate,
  { deep: true }
);

// Watch theme changes (The parent usually calls updateCharts, but we watch just in case)
watch(() => themeStore.theme, debouncedUpdate, { deep: true });
</script>

<style scoped>
.chart-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}

.config-panel {
  flex: 0 0 auto;
  border-bottom: 1px solid #ebedf0;
  max-height: 40%;
  overflow-y: auto;
}

.action-buttons {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

.mapping-config {
  margin-top: 15px;
}

.config-row {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.config-row .label {
  width: 80px;
  font-weight: bold;
  color: #646566;
  font-size: 14px;
}

.native-select {
  padding: 4px;
  border: 1px solid #dcdee0;
  border-radius: 4px;
}

.series-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.series-item {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #fff;
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
}

.series-item-header {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 120px;
}

.series-options {
  font-size: 12px;
  color: #666;
}

.chart-wrapper {
  flex: 1;
  padding: 20px;
  min-height: 300px;
}

.chart-container {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.data-controls {
  padding: 10px 16px;
  background: #fff;
}

.data-table-container {
  max-height: 60vh;
  overflow: auto;
  padding: 10px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th,
.data-table td {
  border: 1px solid #eee;
  padding: 8px;
  text-align: left;
}

.data-table th {
  position: sticky;
  top: 0;
  background: #f7f8fa;
  font-weight: bold;
  z-index: 1;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #999;
}
</style>
