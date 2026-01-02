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

        // Set defaults: Temperature on Left, Humidity on Right
        const humSeries = seriesConfigs.value.find(s => s.field === 'Humidity')
        if (humSeries) {
            humSeries.yAxisIndex = 1
        }
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

                    // Auto-select defaults
                    if (headers.value.length > 0) {
                        xAxisField.value = headers.value[0] || ''
                        // Select up to 2 other numeric fields as series by default
                        const numericFields = headers.value.slice(1).filter(h => {
                            const val = firstRow[h]
                            return typeof val === 'number'
                        })

                        seriesConfigs.value = numericFields.slice(0, 2).map((field) => ({
                            field,
                            type: 'line', // default type
                            yAxisIndex: 0,
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
            seriesConfigs.value.push({
                field,
                type: chartType.value,
                yAxisIndex: 0,
                name: field
            })
        }
    }

    const removeSeries = (index: number) => {
        seriesConfigs.value.splice(index, 1)
    }

    const updateSeries = (index: number, config: Partial<SeriesConfig>) => {
        if (seriesConfigs.value[index]) {
            Object.assign(seriesConfigs.value[index], config)
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
