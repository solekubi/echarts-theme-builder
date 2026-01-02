import { ref } from 'vue'
import Papa from 'papaparse'

export type ChartType = 'line' | 'bar' | 'scatter' | 'pie'

export interface SeriesConfig {
    field: string
    type: ChartType
    yAxisIndex: 0 | 1 // 0 for left, 1 for right
    name?: string
}

export const useDataStore = () => {
    // Global state for data
    const rawCsv = ref<string>('')
    const parsedData = ref<any[]>([])
    const headers = ref<string[]>([])

    // Configuration
    const xAxisField = ref<string>('')
    const chartType = ref<ChartType>('line')
    const seriesConfigs = ref<SeriesConfig[]>([])
    // Cache to remember settings (like yAxisIndex) when a series is removed and re-added
    const seriesConfigCache = ref<Record<string, SeriesConfig>>({})
    const isDualAxis = ref(false)

    // Default demo data
    const loadDemoData = () => {
        const headers = ['Time', 'Temperature', 'Humidity']
        const rows = []

        // Start from 2026-01-01
        const startTime = new Date('2026-01-01T00:00:00').getTime()
        const oneYearHours = 365 * 24

        for (let i = 0; i < oneYearHours; i++) {
            const currentTime = new Date(startTime + i * 3600 * 1000)
            // Format: YYYY-MM-DD HH:mm
            const timeStr = currentTime.toISOString().replace('T', ' ').substring(0, 16)

            const month = currentTime.getMonth() // 0-11
            const hour = currentTime.getHours() // 0-23

            // Simulation Logic
            // 1. Seasonal Trend: Peak in July (Month 6), Trough in Jan
            const seasonal = 15 - 10 * Math.cos(2 * Math.PI * (month / 11.5))

            // 2. Daily Trend: Peak at 14:00
            const daily = 5 * Math.sin(2 * Math.PI * ((hour - 9) / 24))

            // 3. Random components
            const noise = (Math.random() - 0.5) * 3

            const temp = seasonal + daily + noise

            // Humidity usually inverse to temperature to some degree
            let humidity = 60 - (temp - 15) * 1.5 + daily * 0.5 + (Math.random() - 0.5) * 15
            humidity = Math.max(10, Math.min(98, humidity))

            rows.push(`${timeStr},${temp.toFixed(1)},${humidity.toFixed(1)}`)
        }

        const csvData = headers.join(',') + '\n' + rows.join('\n')
        processCsv(csvData)
        // Hardcoded logic removed; processCsv now handles auto-detection
    }

    const processCsv = (csv: string) => {
        rawCsv.value = csv
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // Auto convert numbers
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    parsedData.value = results.data
                    // Cast to any to access dynamic properties safely or assume string[] keys
                    const firstRow = results.data[0] as Record<string, any>
                    headers.value = results.meta.fields || Object.keys(firstRow)

                    // Clear Series Configs & Cache on new data load
                    seriesConfigs.value = []
                    seriesConfigCache.value = {}

                    // Auto-select defaults
                    if (headers.value.length > 0) {
                        xAxisField.value = headers.value[0] || ''
                        // Select up to 2 other numeric fields as series by default
                        const numericFields = headers.value.slice(1).filter(h => {
                            const val = firstRow[h]
                            return typeof val === 'number'
                        })

                        const selectedFields = numericFields.slice(0, 2);

                        // Smart Axis Detection
                        // If we have 2 series, check if their magnitudes differ significantly
                        let useDualAxis = false;
                        if (selectedFields.length === 2) {
                            const getAvg = (field: string) => {
                                let sum = 0;
                                let count = 0;
                                const limit = Math.min(results.data.length, 50);
                                for (let i = 0; i < limit; i++) {
                                    const val = (results.data[i] as any)[field];
                                    if (typeof val === 'number') {
                                        sum += Math.abs(val);
                                        count++;
                                    }
                                }
                                return count > 0 ? sum / count : 0;
                            };

                            const avg0 = getAvg(selectedFields[0]!);
                            const avg1 = getAvg(selectedFields[1]!);

                            // If one average is 0, avoid division by zero issues, just don't split unless logic says otherwise
                            if (avg0 > 0 && avg1 > 0) {
                                const ratio = Math.max(avg0, avg1) / Math.min(avg0, avg1);
                                // If ratio > 2 (e.g. 20 vs 40 is borderline, 20 vs 50 triggers), use dual axis
                                // User case: 18 vs 85 -> Ratio ~4.7 -> Triggers
                                if (ratio > 2.0) {
                                    useDualAxis = true;
                                }
                            }
                        }

                        seriesConfigs.value = selectedFields.map((field, index) => ({
                            field,
                            type: 'line', // default type
                            yAxisIndex: (useDualAxis && index === 1) ? 1 : 0,
                            name: field
                        }))
                    }
                }
            },
            error: (error: any) => {
                console.error('CSV Parse Error:', error)
            }
        })
    }

    // Actions
    const addSeries = (field: string) => {
        if (!seriesConfigs.value.find(s => s.field === field)) {
            // Check cache first
            if (seriesConfigCache.value[field]) {
                seriesConfigs.value.push({ ...seriesConfigCache.value[field] })
            } else {
                seriesConfigs.value.push({
                    field,
                    type: chartType.value,
                    yAxisIndex: 0,
                    name: field
                })
            }
        }
    }

    const removeSeries = (index: number) => {
        const removed = seriesConfigs.value[index]
        if (removed) {
            // Save to cache before removing
            seriesConfigCache.value[removed.field] = { ...removed }
        }
        seriesConfigs.value.splice(index, 1)
    }

    const updateSeries = (index: number, config: Partial<SeriesConfig>) => {
        if (seriesConfigs.value[index]) {
            Object.assign(seriesConfigs.value[index], config)
            // Update cache as well to keep it fresh
            const s = seriesConfigs.value[index]
            seriesConfigCache.value[s.field] = { ...s }
        }
    }

    return {
        rawCsv,
        parsedData,
        headers,
        xAxisField,
        chartType,
        seriesConfigs,
        isDualAxis,
        loadDemoData,
        processCsv,
        addSeries,
        removeSeries,
        updateSeries
    }
}

// Create a singleton instance
let instance: ReturnType<typeof useDataStore> | null = null
export const useGlobalDataStore = () => {
    if (!instance) instance = useDataStore()
    return instance
}
