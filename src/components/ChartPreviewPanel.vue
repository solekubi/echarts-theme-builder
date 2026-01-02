```
<template>
  <div class="chart-preview">
    <!-- 1. Top Toolbar: Data Actions -->
    <div class="preview-toolbar">
      <div class="toolbar-title">
        <van-field
          v-model="chartTitle"
          :placeholder="$t('preview.chartPreview')"
          class="chart-title-input"
          :border="false"
        />
      </div>
      <div class="toolbar-actions">
        <input
          type="file"
          ref="fileInputRef"
          accept=".csv"
          style="display: none"
          @change="handleFileUpload"
        />
        <van-button
          size="small"
          icon="down"
          plain
          type="primary"
          @click="triggerFileUpload"
          >{{ $t("preview.import") }}</van-button
        >
        <van-button
          size="small"
          icon="edit"
          plain
          type="primary"
          @click="showPasteDialog = true"
          >{{ $t("preview.paste") }}</van-button
        >
        <van-button
          size="small"
          icon="play-circle-o"
          plain
          type="success"
          @click="loadDemo"
          >{{ $t("preview.demo") }}</van-button
        >
        <van-button
          size="small"
          icon="eye-o"
          @click="showDataDialog = true"
          :disabled="!hasData"
        >
          {{ $t("preview.data") }}
        </van-button>

        <!-- Language Switcher: Reverted to RadioGroup style -->
        <div class="lang-switcher">
          <van-radio-group v-model="locale" direction="horizontal">
            <van-radio
              v-for="lang in availableLanguages"
              :key="lang.code"
              :name="lang.code"
              >{{ lang.name }}</van-radio
            >
          </van-radio-group>
        </div>
      </div>
    </div>

    <!-- 2. Settings Bar (Visible only when data exists) -->
    <div class="settings-bar" v-if="hasData">
      <!-- Chart Type -->
      <div class="setting-item">
        <span class="setting-label">{{ $t("preview.type") }}</span>
        <van-radio-group
          v-model="dataStore.chartType.value"
          direction="horizontal"
          class="compact-radio"
        >
          <van-radio name="line">Line</van-radio>
          <van-radio name="bar">Bar</van-radio>
          <van-radio name="scatter">Scatter</van-radio>
          <van-radio name="pie">Pie</van-radio>
        </van-radio-group>
      </div>

      <van-divider vertical />

      <!-- X-Axis -->
      <div class="setting-item" v-if="dataStore.chartType.value !== 'pie'">
        <span class="setting-label">{{ $t("preview.xAxis") }}</span>
        <select v-model="dataStore.xAxisField.value" class="native-select">
          <option v-for="h in dataStore.headers.value" :key="h" :value="h">
            {{ h }}
          </option>
        </select>
      </div>

      <!-- Time Settings (Conditional) -->
      <template v-if="isTimeAxis">
        <van-divider vertical />

        <!-- Date Range Filter -->
        <div class="setting-item">
          <span class="setting-label">{{ $t("preview.filter") }}</span>
          <div class="date-inputs">
            <VDatePicker
              v-model.range="dateRange"
              :min-date="calendarMinDate"
              :max-date="calendarMaxDate"
              mode="date"
              :popover="{ visibility: 'click' }"
              color="blue"
              is-dark="system"
            >
              <template #default="{ inputValue, inputEvents }">
                <div class="date-picker-inputs">
                  <input
                    :value="inputValue.start"
                    v-on="inputEvents.start"
                    placeholder="Start Date"
                    class="date-input"
                    readonly
                  />
                  <span class="date-separator">~</span>
                  <input
                    :value="inputValue.end"
                    v-on="inputEvents.end"
                    placeholder="End Date"
                    class="date-input"
                    readonly
                  />
                </div>
              </template>
            </VDatePicker>
            <van-icon
              name="clear"
              v-if="dateRange.start || dateRange.end"
              @click="resetDateInputs"
              class="clear-icon"
            />
          </div>
        </div>

        <van-divider vertical />

        <!-- Granularity -->
        <div class="setting-item">
          <span class="setting-label">{{ $t("preview.granularity") }}</span>
          <select v-model="granularity" class="native-select">
            <option value="raw">{{ $t("preview.raw") }}</option>
            <option value="hour">{{ $t("preview.hour") }}</option>
            <option value="day">{{ $t("preview.day") }}</option>
            <option value="month">{{ $t("preview.month") }}</option>
            <option value="year">{{ $t("preview.year") }}</option>
          </select>
        </div>
      </template>

      <van-divider vertical v-if="dataStore.chartType.value !== 'pie'" />

      <!-- Series Config -->
      <div class="setting-item series-setting">
        <span class="setting-label">{{ $t("preview.series") }}</span>
        <div class="series-tags">
          <div
            v-for="h in availableSeriesFields"
            :key="h"
            class="series-tag"
            :class="{ active: isSeriesSelected(h) }"
            @click="toggleSeries(h, !isSeriesSelected(h))"
          >
            {{ h }}
            <span
              v-if="isSeriesSelected(h) && dataStore.chartType.value !== 'pie'"
              class="axis-toggle"
              @click.stop="toggleAxis(h)"
              title="Toggle Axis (L/R)"
            >
              {{ getSeriesYAxis(h) === 1 ? "R" : "L" }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Chart Content -->
    <div class="chart-content">
      <div v-if="!hasData" class="empty-state">
        <van-icon name="chart-trending-o" class="empty-icon" />
        <p>请导入或粘贴 CSV 数据以开始预览</p>
        <p class="sub-text">Please import or paste CSV data to preview</p>
        <van-button type="primary" size="small" @click="loadDemo"
          >加载示例数据</van-button
        >
      </div>
      <div v-else class="chart-card">
        <div ref="chartDom" class="chart-render-area"></div>
      </div>
    </div>

    <!-- Dialogs -->
    <!-- View Data Dialog -->
    <van-dialog
      v-model:show="showDataDialog"
      title="数据预览 / Data Preview"
      width="80%"
      :showConfirmButton="false"
      closeOnClickOverlay
    >
      <div class="data-table-container">
        <table class="data-table" v-if="hasData">
          <thead>
            <tr>
              <th v-for="h in dataStore.headers.value" :key="h">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
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

    <!-- Paste Data Dialog -->
    <van-dialog
      v-model:show="showPasteDialog"
      title="粘贴 CSV 数据 / Paste CSV"
      show-cancel-button
      confirm-button-text="解析 / Parse"
      @confirm="handleDataLoad"
    >
      <div class="paste-container">
        <van-field
          v-model="csvInput"
          rows="10"
          autosize
          type="textarea"
          placeholder="Paste your CSV content here..."
          class="paste-textarea"
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  markRaw,
  computed,
  reactive,
} from "vue";
import * as echarts from "echarts";
import { useThemeStore } from "../stores/theme";
import { useGlobalDataStore, type SeriesConfig } from "../stores/data"; // Import SeriesConfig
// ... imports ...
// The duplicate imports below are removed as per the instruction to avoid unrelated edits and keep the file syntactically correct.
// import * as echarts from "echarts";
// import { useThemeStore } from "../stores/theme";
// import { useGlobalDataStore } from "../stores/data";
// ... removed unused useI18n ...

import { useLocalization } from "../composables/useLocalization";
import { DatePicker as VDatePicker } from "v-calendar";
import "v-calendar/style.css";

// Store interaction
const themeStore = useThemeStore();
const dataStore = useGlobalDataStore();
const { locale, availableLanguages, t } = useLocalization();

// UI State
// ... removed unused activeNames ...
const csvInput = ref("");

// ... (logic)
// Removed stray/duplicate code block that was accidentally inserted.
const showDataDialog = ref(false);
const showPasteDialog = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const chartDom = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
const chartTitle = ref("Chart Title");

// Filter & Granularity State
const granularity = ref("raw"); // raw, hour, day, month, year

// Date Range State for VCalendar (uses Date objects)
const dateRange = ref<any>({
  start: undefined,
  end: undefined,
});

// Calendar min/max dates (will be updated based on data)
const calendarMinDate = ref<Date>(new Date(2020, 0, 1));
const calendarMaxDate = ref<Date>(new Date(2030, 11, 31));

// Legacy date state for internal use (YYYY-MM-DD strings)
const dateInputState = reactive({
  start: "",
  end: "",
});

// Sync dateRange with dateInputState
watch(
  dateRange,
  (newRange) => {
    if (newRange.start && newRange.end) {
      dateInputState.start = formatDateToString(newRange.start);
      dateInputState.end = formatDateToString(newRange.end);
    }
  },
  { deep: true }
);

// Helper to format Date object to YYYY-MM-DD string
const formatDateToString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

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
      }
    };
    reader.readAsText(file);
  }
  // Reset input so same file can be selected again
  target.value = "";
};

// Computed
const hasData = computed(() => dataStore.parsedData.value.length > 0);

const availableSeriesFields = computed(() => {
  return dataStore.headers.value.filter(
    (h) => h !== dataStore.xAxisField.value
  );
});

const isTimeAxis = computed(() => {
  if (!hasData.value) return false;
  // Simple check: see if the first few values of X-axis parse as valid dates
  const xField = dataStore.xAxisField.value;
  const sample = dataStore.parsedData.value.slice(0, 5);
  return sample.every((r) => !isNaN(Date.parse(r[xField])));
});

// Primary Data Processing (Filter + Aggregate)
const processedData = computed(() => {
  let data = dataStore.parsedData.value;
  if (!hasData.value) return [];

  const xField = dataStore.xAxisField.value;

  // 1. Filter by Date Range
  if (isTimeAxis.value && (dateInputState.start || dateInputState.end)) {
    // Parse string dates to timestamps
    // Start date is at 00:00:00
    const startTs = dateInputState.start
      ? new Date(dateInputState.start + "T00:00:00").getTime()
      : -Infinity;

    // End date is at 23:59:59.999
    const endTs = dateInputState.end
      ? new Date(dateInputState.end + "T23:59:59.999").getTime()
      : Infinity;

    data = data.filter((r) => {
      const t = new Date(r[xField]).getTime();
      return t >= startTs && t <= endTs;
    });
  }

  // 2. Aggregate by Granularity
  if (isTimeAxis.value && granularity.value !== "raw") {
    // Helper to get bucket timestamp
    const getBucketTs = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();
      const h = d.getHours();

      if (granularity.value === "year") return new Date(y, 0, 1).getTime();
      if (granularity.value === "month") return new Date(y, m, 1).getTime();
      if (granularity.value === "day") return new Date(y, m, day).getTime();
      if (granularity.value === "hour") return new Date(y, m, day, h).getTime();
      return d.getTime();
    };

    // Helper to format bucket key for display
    const formatBucket = (ts: number) => {
      const d = new Date(ts);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");

      if (granularity.value === "year") return `${y}`;
      if (granularity.value === "month") return `${y}-${m}`;
      if (granularity.value === "day") return `${y}-${m}-${day}`;
      if (granularity.value === "hour") return `${y}-${m}-${day} ${h}:00`;
      return d.toISOString();
    };

    // Grouping
    const groups: Record<number, any[]> = {};
    data.forEach((row) => {
      const ts = getBucketTs(row[xField]);
      if (!groups[ts]) groups[ts] = [];
      groups[ts].push(row);
    });

    // Averaging numerical fields
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((ts) => {
        const groupRows = groups[ts];
        if (!groupRows) return { [xField]: formatBucket(ts) }; // Safety check

        const result: any = { [xField]: formatBucket(ts) };

        // Average configured series
        dataStore.seriesConfigs.value.forEach((series) => {
          const field = series.field;
          let sum = 0;
          let count = 0;

          groupRows.forEach((r) => {
            const val = parseFloat(r[field]);
            if (!isNaN(val)) {
              sum += val;
              count++;
            }
          });

          const avg = count > 0 ? sum / count : 0;
          result[field] = parseFloat(avg.toFixed(2));
        });

        return result;
      });
  }

  return data;
});

const previewData = computed(() => {
  return processedData.value.slice(0, 100); // Limit to 100 rows for view per common table limits
});

// Methods
const loadDemo = () => {
  dataStore.loadDemoData();
  csvInput.value = dataStore.rawCsv.value;
  chartTitle.value = "Weather Data Analysis";
};

const handleDataLoad = () => {
  dataStore.processCsv(csvInput.value);
  showPasteDialog.value = false; // Close dialog if open

  // Reset filters used to happen here, but now we rely on the watcher below
  // to set smart defaults when data changes.
  // However, we should ensure we reset explicit states to avoid confusion
  // before the watcher kicks in.
  granularity.value = "raw";
  chartTitle.value = "Chart Title";
};

const resetDateInputs = () => {
  dateRange.value = { start: undefined, end: undefined };
  dateInputState.start = "";
  dateInputState.end = "";
};

// Watch data source changes to Auto-Set defaults
watch(
  () => dataStore.parsedData.value,
  (newData) => {
    if (newData.length > 0) {
      // Reset Date Filters on new data
      dateInputState.start = "";
      dateInputState.end = "";

      // We need to wait for isTimeAxis computed to update.
      // Since this watcher has flush: 'post' (default for watch? No, default is pre. We need user specified or default)
      // Actually computed props are updated lazily. accessing isTimeAxis.value is enough.

      if (isTimeAxis.value) {
        const xField = dataStore.xAxisField.value;
        const dates = newData
          .map((r) => new Date(r[xField]).getTime())
          .filter((t) => !isNaN(t))
          .sort((a, b) => a - b);

        if (dates.length > 0) {
          const minTs = dates[0];
          const maxTs = dates[dates.length - 1];

          // Ensure valid numbers
          if (minTs === undefined || maxTs === undefined) return;

          // Re-implement with strict checks
          const maxD = new Date(maxTs);
          const minD = new Date(minTs);

          // Update calendar min/max dates to match data range
          calendarMinDate.value = minD;
          calendarMaxDate.value = maxD;

          // Default range: Last 1 month
          const startDate = new Date(maxD);
          startDate.setMonth(startDate.getMonth() - 1);

          // Ensure start is not before actual min
          const finalStart = startDate.getTime() < minTs ? minD : startDate;

          // Update VCalendar dateRange (Date objects)
          dateRange.value = {
            start: finalStart,
            end: maxD,
          };

          // Helper: Format to local YYYY-MM-DD
          const toLocalIsoDate = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };

          dateInputState.start = toLocalIsoDate(finalStart);
          dateInputState.end = toLocalIsoDate(maxD);
        }
      }
    }
  },
  { flush: "post" }
); // Ensure DOM/computed updates have happened;

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

const toggleAxis = (field: string) => {
  const currentAxis = getSeriesYAxis(field);
  updateSeriesAxis(field, currentAxis === 0);
};

// Chart Generation Logic
const getChartOption = () => {
  const d = dataStore;
  const displayData = processedData.value;

  if (displayData.length === 0) return {};

  const isPie = d.chartType.value === "pie";

  // Base Option
  const option: any = {
    title: {
      text: chartTitle.value,
      left: "center",
      top: 10,
    },
    tooltip: {
      trigger: isPie ? "item" : "axis",
      axisPointer: { type: "shadow" }, // Better for mixed charts
    },
    toolbox: {
      right: 20,
      top: 10,
      feature: {
        saveAsImage: {
          title: t("preview.toolboxSaveAsImage"),
        },
        dataZoom: {
          title: {
            zoom: t("preview.toolboxDataZoom"),
            back: t("preview.toolboxDataZoomBack"),
          },
        },
        restore: { title: t("preview.toolboxRestore") },
      },
    },
    legend: {
      top: 45,
      left: 0, // Top-left as requested, left 0 works better if grid is pushed down
      type: "scroll",
      width: "100%", // Scrollable full width
    },
    grid: {
      left: "3%",
      right: "5%",
      bottom: "10%", // Give space for dataZoom
      top: 100, // Clear title and legend
      containLabel: true,
    },
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10 }],
    dataset: {
      source: displayData,
    },
  };

  if (isPie) {
    option.xAxis = undefined;
    option.yAxis = undefined;
    option.dataZoom = undefined; // No zoom for pie
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
      type: "category", // Even for time, category is often safer for CSV unless fully parsed times
      data: displayData.map((row: any) => row[d.xAxisField.value]),
    };

    // Check for Dual Axis
    const leftSeries = d.seriesConfigs.value.filter((s) => s.yAxisIndex === 0);
    const rightSeries = d.seriesConfigs.value.filter((s) => s.yAxisIndex === 1);

    // Dynamic Axis Naming Helper
    const getAxisName = (seriesList: SeriesConfig[]) => {
      if (seriesList.length === 0) return "";

      // Safe access to names
      if (seriesList.length <= 2) {
        return seriesList.map((s: SeriesConfig) => s.name || "").join(" / ");
      }

      const n1 = seriesList[0]?.name || "";
      const n2 = seriesList[1]?.name || "";
      return `${n1} / ${n2}...`;
    };

    const leftName = getAxisName(leftSeries);
    const rightName = getAxisName(rightSeries);

    option.yAxis = [{ type: "value", name: leftName || "Value" }];

    if (rightSeries.length > 0) {
      option.yAxis.push({
        type: "value",
        name: rightName,
        position: "right",
        alignTicks: true, // Key fix for dual axis alignment
        splitLine: { show: false }, // Avoid messy grid lines
      });
    }

    option.series = d.seriesConfigs.value.map((s) => ({
      type: d.chartType.value,
      name: s.name,
      yAxisIndex: s.yAxisIndex,
      data: displayData.map((row: any) => row[s.field]),
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

  // LOCALE UPDATE: ensure chart locale matches
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
    processedData,
    dataStore.parsedData,
    dataStore.chartType,
    dataStore.xAxisField,
    dataStore.seriesConfigs,
    granularity, // Watch granularity for immediate chart update
    () => dateInputState.start,
    () => dateInputState.end,
    locale, // Watch locale for immediate chart update
  ],
  debouncedUpdate,
  { deep: true }
);

// Watch theme changes (The parent usually calls updateCharts, but we watch just in case)
watch(() => themeStore.theme, debouncedUpdate, { deep: true });

// Watch title for real-time updates
watch(chartTitle, debouncedUpdate);
</script>

<style scoped>
.chart-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  overflow: hidden;
}

/* 1. Toolbar */
.preview-toolbar {
  flex: 0 0 60px; /* Slightly taller */
  background: #fff;
  border-bottom: 1px solid #ebedf0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  z-index: 10;
}

.toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: #323233;
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-title-input :deep(.van-field__control) {
  font-weight: bold;
  font-size: 18px;
  color: #323233;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 2. Settings Bar */
.settings-bar {
  flex: 0 0 auto;
  background: #fff;
  border-bottom: 1px solid #ebedf0;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-label {
  font-size: 12px;
  font-weight: 600;
  color: #646566;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.compact-radio {
  font-size: 13px;
}

.native-select {
  padding: 4px 8px;
  border: 1px solid #dcdee0;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #323233;
  outline: none;
}

.native-select:focus {
  border-color: var(--van-primary-color);
}

.series-setting {
  flex: 1; /* Take remaining width */
  min-width: 200px;
}

.series-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.series-tag {
  padding: 4px 10px;
  border-radius: 16px;
  background: #f2f3f5;
  color: #646566;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.series-tag:hover {
  background: #ebedf0;
}

.series-tag.active {
  background: var(--van-primary-color);
  color: #fff;
  border-color: var(--van-primary-color);
}

.axis-toggle {
  background: rgba(255, 255, 255, 0.2);
  padding: 0 4px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
}

.axis-toggle:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* Date Inputs */
.date-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #dcdee0;
  border-radius: 4px;
  padding: 2px 6px;
}

.date-input {
  border: none;
  font-size: 13px;
  color: #323233;
  outline: none;
  background: transparent;
  width: 110px; /* Force width */
}

.date-separator {
  color: #969799;
}

.clear-icon {
  font-size: 14px;
  color: #969799;
  cursor: pointer;
}

.clear-icon:hover {
  color: #323233;
}

/* VCalendar Date Picker Styles */
.date-picker-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #dcdee0;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.date-picker-inputs:hover {
  border-color: var(--van-primary-color);
}

.date-picker-inputs .date-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 2px 4px;
  font-size: 13px;
  color: #323233;
  cursor: pointer;
  background: transparent;
  min-width: 90px;
}

.date-picker-inputs .date-input::placeholder {
  color: #969799;
}

.date-picker-inputs .date-separator {
  color: #969799;
  font-weight: 500;
}

.lang-switcher {
  display: flex;
  align-items: center;
  margin-left: 10px;
}

/* 3. Chart Content */
.chart-content {
  flex: 1;
  padding: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chart-card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  padding: 16px;
  position: relative;
}

.chart-render-area {
  width: 100%;
  height: 100%;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #969799;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 4px 0;
  font-size: 16px;
}

.empty-state .sub-text {
  font-size: 13px;
  color: #c8c9cc;
  margin-bottom: 20px;
}

/* Dialogs */
.data-table-container {
  max-height: 60vh;
  overflow: auto;
  padding: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th,
.data-table td {
  border: 1px solid #ebedf0;
  padding: 10px 12px;
  text-align: left;
}

.data-table th {
  position: sticky;
  top: 0;
  background: #f7f8fa;
  font-weight: 600;
  color: #323233;
  z-index: 1;
}

.data-table tr:hover td {
  background: #fcfcfc;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #969799;
}

.paste-container {
  padding: 20px 0 0 0;
}

.paste-textarea :deep(.van-field__control) {
  font-family: monospace;
  font-size: 12px;
  background: #f7f8fa;
  padding: 10px;
  border-radius: 4px;
}
</style>
