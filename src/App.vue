<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
// Simple fixed sidebar layout without responsive design
import ChartPreviewPanel from "./components/ChartPreviewPanel.vue";
import ThemePanel from "./components/ThemePanel.vue";
import { useLocalization } from "./composables/useLocalization";
import {
  RadioGroup as VanRadioGroup,
  Radio as VanRadio,
  Row as VanRow,
  Col as VanCol,
} from "vant";

// Set up language control
const { switchLanguage, currentLanguage, availableLanguages } =
  useLocalization();
const currentLang = ref(currentLanguage);
// Only show language selector in dev/preview mode
// Use import.meta.env.DEV to only show in development mode
const showLanguageSelector = import.meta.env.VITE_SHOW_LANGUAGE_SELECTOR;

const onLanguageChange = (lang: string) => {
  switchLanguage(lang);
};

// Get reference to chart preview panel
const chartPreviewRef = useTemplateRef("chartPreviewRef");
</script>

<template>
  <div class="theme-builder-body">
    <div class="container-fluid" id="content">
      <VanRow class="row-container" :gutter="0">
        <VanCol span="6" class="theme-config">
          <ThemePanel :chart-preview-ref="chartPreviewRef" />
        </VanCol>

        <VanCol span="18" class="chart-container">
          <ChartPreviewPanel ref="chartPreviewRef" />
        </VanCol>
      </VanRow>
    </div>
  </div>
</template>

<style scoped>
.theme-builder-body {
  width: 100%;
  height: 100%;
  position: relative;
  --van-button-default-height: auto;
  --van-button-normal-padding: 8px 10px;
}

.language-selector {
  position: absolute;
  bottom: 20px;
  right: 20px;
  top: auto;
  z-index: 1000;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #ebedf0;
}

.container-fluid {
  height: 100%;
  padding: 0;
  width: 100%;
}

.row-container {
  height: 100%;
  display: flex !important;
  flex-direction: row !important;
}

.theme-config {
  height: 100%;
  overflow-y: auto;
  background-color: #ffffff;
  border-right: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  padding: 0;
  box-sizing: border-box;
  flex: 0 0 25%; /* Fixed 25% width */
}

.chart-container {
  height: 100%;
  overflow: hidden;
  background-color: #ffffff;
  padding: 20px;
  box-sizing: border-box;
  flex: 1; /* Take remaining space */
}

.placeholder {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  border: 2px dashed #dee2e6;
  border-radius: 4px;
  font-size: 16px;
}
</style>
